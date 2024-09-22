import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  deposits_deposit_status,
  deposits_interest_credit_frequency,
  deposits_payment_frequency,
  loans_emi_frequency,
  loans_interest_frequency,
  Prisma,
} from "@prisma/client";
import { DatabaseService } from "../database/database.service";
import { calculateEmi, getTotalPayable } from "../utils/calculateEmi";

@Injectable()
export class DepositsService {
  readonly payment_frequency = {
    Daily: 1,
    Weekly: 7,
    Monthly: 30,
    Quarterly: 90,
    Yearly: 365,
    Onetime: 1,
    Anytime: 1,
  };

  constructor(private readonly databaseService: DatabaseService) {}

  async fetchAllDeposits(
    category: string,
    limit: number,
    skip: number,
    status: string | undefined
  ) {
    const deposits = await this.databaseService.deposits.findMany({
      orderBy: {
        created_at: "desc",
      },
      where: {
        category,
        deposit_status: status
          ? (status as deposits_deposit_status)
          : {
              notIn: ["Active", "Pending", "Rejected"],
            },
      },
      take: limit,
      skip: skip,
    });

    const total = await this.databaseService.deposits.count({
      where: {
        deposit_status: status
          ? (status as deposits_deposit_status)
          : {
              notIn: ["Active", "Pending", "Rejected"],
            },
      },
    });

    return {
      status: true,
      message: {
        deposits,
        total,
      },
    };
  }

  async findDepositsByUserId(
    userid: number,
    category: string,
    limit: number,
    skip: number,
    status: string | undefined
  ) {
    const deposits = await this.databaseService.deposits.findMany({
      orderBy: {
        created_at: "desc",
      },
      where: {
        category,
        user_id: userid,
        deposit_status: status
          ? (status as deposits_deposit_status)
          : {
              in: ["Active", "Pending", "Rejected"],
            },
      },
      take: limit,
      skip: skip,
    });

    const total = await this.databaseService.deposits.count({
      where: {
        user_id: userid,
        deposit_status: status
          ? (status as deposits_deposit_status)
          : {
              in: ["Active", "Pending", "Rejected"],
            },
      },
    });

    return {
      status: true,
      message: {
        deposits,
        total,
      },
    };
  }

  async applyForDeposit(userid: number, data: any) {
    const pendingExists = await this.databaseService.deposits.count({
      where: {
        user_id: userid,
        deposit_status: "Pending",
      },
    });

    if (pendingExists > 0) {
      throw new BadRequestException(
        "You Already have a deposit application on pending, please contact Branch."
      );
    }

    const getPlan = await this.databaseService.deposit_plans.findFirst({
      where: {
        id: parseInt(data.plan_id as string),
      },
    });

    if (!getPlan) {
      throw new BadRequestException("Invalid Plan!");
    }

    await this.databaseService.deposits.create({
      data: {
        ref_id: data.ref_id
          ? parseInt(data.ref_id.match(/\d*\d/gm)[0])
          : undefined,
        user_id: userid,
        plan_id: parseInt(data.plan_id),
        amount: parseFloat(data.amount),
        total_paid: 0,
        prefered_tenure: parseInt(data.prefered_tenure),
        category: getPlan.category,
        interest_rate: Number(getPlan.interest_rate),
        premature_withdrawal_charge: Number(
          getPlan.premature_withdrawal_charge
        ),
        allow_premature_withdrawal: getPlan.allow_premature_withdrawal,
        maturity_date: data.maturity_date,
        interest_credit_frequency:
          getPlan.allowed_interest_credit_frequency as deposits_interest_credit_frequency,
        payment_frequency:
          getPlan.allowed_payment_frequency as deposits_payment_frequency,
        payment_status: data.payment_status,
        nominee: data.nominee,
        deposit_status: data.deposit_status,
      },
    });

    return { status: true, message: "Deposit has been applied successfully" };
  }

  async reapplyDepositByDepositId(
    userid: number,
    depositId: number,
    data: any
  ) {
    await this.databaseService.deposits.update({
      where: {
        id: depositId,
        user_id: userid,
      },
      data: {
        ref_id: data.ref_id
          ? parseInt(data.ref_id.match(/\d*\d/gm)[0])
          : undefined,
        amount: parseFloat(data.amount),
        prefered_tenure: parseInt(data.prefered_tenure),
        nominee: data.nominee,
        remark: "",
        deposit_status: "Pending",
      },
    });

    return { status: true, message: "Deposit has been re-applied." };
  }

  async findUserDepositById(userid: number, depositId: number) {
    const deposit = await this.databaseService.deposits.findFirst({
      where: {
        id: depositId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        deposit_plan: {
          select: {
            plan_name: true,
            interest_rate: true,
            allow_premature_withdrawal: true,
            premature_withdrawal_charge: true,
            penalty_rate: true,
          },
        },
      },
    });

    const next_pay_date = await this.databaseService.due_record.findFirst({
      orderBy: {
        due_date: "asc",
      },
      where: {
        category: "Deposit",
        plan_id: deposit?.id,
        status: "Due",

        due_date: {
          gt: new Date(new Date().setHours(0, 0, 0)),
        },
      },
    });

    const repayments = await this.databaseService.emi_records.findMany({
      orderBy: {
        pay_date: "desc",
      },
      where: {
        plan_id: deposit?.id,
        category: "Deposit",
      },
      include: {
        collector: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      take: 20,
      skip: 0,
    });

    const emi_paid = await this.databaseService.due_record.count({
      where: {
        plan_id: deposit?.id,
        category: "Deposit",
        status: {
          in: ["Paid", "PartiallyFeed"],
        },
      },
    });

    return {
      status: true,
      data: {
        deposit: {
          ...deposit,
          next_pay_date: next_pay_date?.due_date,
          emi_paid,
        },
        repayments,
      },
    };
  }

  async findUserDeopsitDueById(userid: number, depositId: number) {
    const deposit = await this.databaseService.deposits.findFirst({
      where: {
        id: depositId,
        user_id: userid,
      },
      include: {
        deposit_plan: {
          select: {
            penalty_rate: true,
          },
        },
      },
    });

    const late_fee =
      Number(deposit?.amount) *
      (Number(deposit?.deposit_plan.penalty_rate) / 100);
    const freq = this.payment_frequency[deposit?.payment_frequency ?? "Daily"];

    const tommorow = new Date();
    tommorow.setHours(0, 0, 0);
    tommorow.setDate(tommorow.getDate() + 1);

    const overdues = await this.databaseService.due_record.findMany({
      orderBy: {
        due_date: "desc",
      },
      where: {
        category: "Deposit",
        plan_id: deposit?.id,
        status: "Overdue",
      },
    });

    const updated_overdues = [];

    for (let i = 0; i < overdues.length; i++) {
      const differenceInMilliseconds =
        new Date().getTime() - new Date(overdues[i].due_date).getTime();
      const differenceInDays = Math.floor(
        differenceInMilliseconds / (1000 * 60 * 60 * 24)
      );
      const estimated_fee = Math.floor(differenceInDays / freq) * late_fee;

      const updated_due = await this.databaseService.due_record.update({
        where: {
          id: overdues[i].id,
        },
        data: {
          late_fee: estimated_fee,
        },
      });

      updated_overdues.push(updated_due);
    }

    const partiallyPaid = await this.databaseService.due_record.findMany({
      orderBy: {
        due_date: "desc",
      },
      where: {
        category: "Deposit",
        plan_id: deposit?.id,
        status: {
          in: ["PartiallyPaid", "PartiallyFeed"],
        },
        due_date: {
          lt: tommorow,
        },
      },
    });

    const updated_partial_dues = [];

    for (let i = 0; i < partiallyPaid.length; i++) {
      const differenceInMilliseconds =
        new Date().getTime() - new Date(partiallyPaid[i].due_date).getTime();
      const differenceInDays = Math.floor(
        differenceInMilliseconds / (1000 * 60 * 60 * 24)
      );
      const estimated_fee = Math.floor(differenceInDays / freq) * late_fee;

      const updated_due = await this.databaseService.due_record.update({
        where: {
          id: partiallyPaid[i].id,
        },
        data: {
          late_fee: estimated_fee,
        },
      });

      updated_partial_dues.push(updated_due);
    }

    const dues = await this.databaseService.due_record.findMany({
      orderBy: {
        due_date: "desc",
      },
      where: {
        category: "Deposit",
        plan_id: deposit?.id,
        status: "Due",

        due_date: {
          lt: tommorow,
        },
      },
    });

    const totalOverdue = updated_overdues.reduce((prv_due, cur_due) => {
      return prv_due + Number(cur_due.emi_amount);
    }, 0);

    const overdueLateFee = updated_overdues.reduce((prv_due, cur_due) => {
      return prv_due + (Number(cur_due.late_fee) - Number(cur_due.paid_fee));
    }, 0);

    const totalPartialRemain = updated_partial_dues.reduce(
      (prv_due, cur_due) => {
        return (
          prv_due + (Number(cur_due.emi_amount) - Number(cur_due.paid_amount))
        );
      },
      0
    );

    const partialLateFee = partiallyPaid.reduce((prv_due, cur_due) => {
      return prv_due + (Number(cur_due.late_fee) - Number(cur_due.paid_fee));
    }, 0);

    const totalDue = dues.reduce((prv_due, cur_due) => {
      return prv_due + Number(cur_due.emi_amount);
    }, 0);

    const totalLateFee = overdueLateFee + partialLateFee;

    console.log(overdues);
    console.log(partiallyPaid);
    console.log(dues);

    return {
      status: true,
      data: {
        overdues: updated_overdues,
        partiallyPaid: updated_partial_dues,
        dues,
        totalOverdue,
        totalPartialRemain,
        totalDue,
        totalLateFee,
      },
    };
  }

  async findUserDepositRepaymentsById(
    userid: number,
    depositId: number,
    limit: number,
    skip: number
  ) {
    const repayments = await this.databaseService.emi_records.findMany({
      orderBy: {
        pay_date: "desc",
      },
      where: {
        plan_id: depositId,
        category: "Deposit",
      },
      include: {
        collector: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      take: limit,
      skip: skip,
    });

    const total = await this.databaseService.emi_records.count({
      where: {
        plan_id: depositId,
        category: "Deposit",
      },
    });

    return {
      status: true,
      data: {
        repayments,
        total,
      },
    };
  }

  async findAssignedAgentsByDepositId(depositid: number, agentid: string) {
    const agents = await this.databaseService.assignments.findMany({
      where: {
        plan_id: depositid,
        category: "Deposit",
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const assigned = agents.map((agent) => agent.agent_id);

    const agentId = (agentid as string).match(/\d*\d/gm);

    // agentId ? parseInt(agentId[0]) : undefined
    const available_agents = await this.databaseService.user.findMany({
      where: {
        id: agentId ? parseInt(agentId[0]) : undefined,
        role: "Agent",
        ac_status: true,
        AND: {
          id: {
            notIn: assigned,
          },
        },
      },
      select: {
        id: true,
        name: true,
      },
      take: 5,
    });

    return {
      status: true,
      data: {
        agents,
        available_agents,
      },
    };
  }
}
