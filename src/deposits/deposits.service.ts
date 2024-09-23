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
import {
  NotificationService,
  templates,
} from "src/notification/notification.service";
import { formateId } from "src/utils/formateId";
import { format } from "date-fns";
import { showAsCurrency } from "src/utils/showAsCurrency";

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

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly notificationService: NotificationService
  ) {}

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

  async approveDepositById(userid: number, depositid: number) {
    await this.databaseService.$transaction(async (prisma) => {
      // set status to active if admin else approved.
      const data = await prisma.deposits.update({
        where: {
          id: depositid,
        },
        data: {
          deposit_status: "Active",
        },
      });

      if (data.category === "FD") {
        const start_date = data?.deposit_date
          ? new Date(data.deposit_date)
          : new Date();

        const maturity_date = new Date(start_date);
        maturity_date.setDate(
          maturity_date.getDate() + 30 * data.prefered_tenure
        );

        const deposit_data = await prisma.deposits.update({
          where: {
            id: depositid,
          },
          data: {
            total_paid: data.amount,
            maturity_date: maturity_date,
          },
          include: {
            user: {
              select: {
                name: true,
                phone: true,
              },
            },
            deposit_plan: {
              select: {
                plan_name: true,
                interest_rate: true,
                allow_premature_withdrawal: true,
                premature_withdrawal_charge: true,
              },
            },
          },
        });

        const update_wallet = await prisma.wallets.update({
          where: {
            user_id: userid,
          },
          data: {
            balance: {
              increment: Number(deposit_data.amount),
            },
          },
        });

        const txn = await prisma.transactions.create({
          data: {
            wallet_id: update_wallet.id,
            amount: Number(deposit_data.amount),
            // fee: Number(total_fee_paid),
            balance: update_wallet.balance,
            txn_type: "Credit",
            txn_status: "Completed",
            txn_note: `FD opening (${formateId(
              deposit_data.id,
              deposit_data.category as "FD" | "RD"
            )})`,
          },
        });

        this.notificationService.sendSMS(
          deposit_data.user.phone,
          templates.Fixed_Deposit_Approved,
          [
            {
              Key: "customer",
              Value: deposit_data.user.name,
            },
            {
              Key: "account",
              Value: formateId(deposit_data.id, "RD"),
            },
            {
              Key: "amount",
              Value: deposit_data.amount.toFixed(2),
            },
            {
              Key: "tenure",
              Value: deposit_data.prefered_tenure.toString(),
            },
          ]
        );
      } else {
        const pay_freq = this.payment_frequency[data.payment_frequency];
        const start_date = data?.deposit_date
          ? new Date(data.deposit_date)
          : new Date();

        const maturity_date = new Date(start_date);
        maturity_date.setDate(
          maturity_date.getDate() + 30 * data.prefered_tenure
        );

        // const repayment_schedule = [];

        // for (let i = 1; i < data.prefered_tenure * 30 + 1; i += pay_freq) {
        //   const next_pay_date = new Date(
        //     new Date(start_date).setDate(start_date.getDate() + i * pay_freq)
        //   );

        //   repayment_schedule.push({
        //     plan_id: data.id,
        //     category: "Deposit",
        //     emi_amount: data.amount,
        //     due_date: next_pay_date,
        //   } as due_record);
        // }

        // await prisma.due_record.createMany({
        //   data: repayment_schedule,
        // });

        const deposit_data = await prisma.deposits.update({
          where: {
            id: depositid,
          },
          data: {
            maturity_date: maturity_date,
          },
          include: {
            user: {
              select: {
                name: true,
                phone: true,
              },
            },
            deposit_plan: {
              select: {
                plan_name: true,
                interest_rate: true,
                allow_premature_withdrawal: true,
                premature_withdrawal_charge: true,
              },
            },
          },
        });

        this.notificationService.sendSMS(
          deposit_data.user.phone,
          templates.Recurring_Deposit_Approved_Confirmation,
          [
            {
              Key: "customer",
              Value: deposit_data.user.name,
            },
            {
              Key: "account",
              Value: formateId(deposit_data.id, "RD"),
            },
            {
              Key: "tenure",
              Value: deposit_data.prefered_tenure.toString(),
            },
          ]
        );
      }
    });

    return {
      status: true,
      message: "Deposit has been approved successfully",
    };
  }

  async rejectDepositByID(depositid: number, remark: string) {
    const deposit_data = await this.databaseService.deposits.update({
      where: {
        id: depositid,
      },
      data: {
        deposit_status: "Rejected",
        amount: 0,
        total_paid: 0,
        remark: remark,
      },
      include: {
        user: {
          select: {
            name: true,
            phone: true,
          },
        },
        deposit_plan: {
          select: {
            plan_name: true,
            interest_rate: true,
            allow_premature_withdrawal: true,
            premature_withdrawal_charge: true,
          },
        },
      },
    });

    this.notificationService.sendSMS(
      deposit_data.user.phone,
      templates.Rejected_Reason,
      [
        {
          Key: "customer",
          Value: deposit_data.user.name,
        },
        {
          Key: "reason",
          Value: deposit_data.remark as string,
        },
      ]
    );

    return {
      status: true,
      data: deposit_data,
    };
  }

  async collectRepayment(req, depositid: number, emi_data) {
    const { total_paid, pay_date, remark } = emi_data;

    const amount = Number(total_paid);

    if (amount <= 0) {
      throw new BadRequestException("Invalid Collection Amount.");
    }

    // let remainingAmount = amount;
    // let remainingFeeAmount = Number(total_fee_paid);

    await this.databaseService.$transaction(async (tx) => {
      const updated_deposit = await tx.deposits.update({
        where: {
          id: depositid,
        },
        data: {
          total_paid: {
            increment: amount,
          },
        },
        include: {
          deposit_plan: {
            select: {
              commission_rate: true,
            },
          },
          user: {
            select: {
              name: true,
              phone: true,
            },
          },
        },
      });

      const now = new Date();

      const emiRecord = await tx.emi_records.create({
        data: {
          plan_id: depositid,
          category: "Deposit",
          amount: amount,
          // late_fee: Number(total_fee_paid),
          total_paid: updated_deposit.total_paid,
          pay_date: new Date(
            new Date(pay_date).setHours(
              now.getHours(),
              now.getMinutes(),
              now.getSeconds()
            )
          ),
          status: ["Admin", "Manager"].includes(req.user.role ?? "")
            ? "Paid"
            : "Collected",
          remark,
          collected_by: req.user.id,
          created_at: new Date(),
        },
      });

      if (["Admin", "Manager"].includes(req.user.role ?? "")) {
        const update_wallet = await tx.wallets.update({
          where: {
            user_id: req.user.id,
          },
          data: {
            balance: {
              increment: amount,
            },
          },
        });

        await tx.transactions.create({
          data: {
            wallet_id: update_wallet.id,
            amount: amount,
            // fee: Number(total_fee_paid),
            balance: update_wallet.balance,
            txn_type: "Credit",
            txn_status: "Completed",
            txn_note: `Repayment from deposit (${formateId(
              updated_deposit.id,
              updated_deposit.category as "FD" | "RD"
            )})`,
          },
        });
      }

      if (updated_deposit.ref_id) {
        // calculate the commision amount
        const commission_amount =
          (amount / 100) * Number(updated_deposit.deposit_plan.commission_rate);

        // get the wallet info of referrer
        const referrer = await tx.user.findFirst({
          where: {
            id: Number(updated_deposit.ref_id),
          },
          include: {
            wallets: true,
          },
        });

        if (referrer && commission_amount > 0) {
          if (!referrer.wallets) return;
          // credit the commission amount to referrer
          const credited_referrer_wallet = await tx.wallets.update({
            where: {
              id: referrer.wallets.id,
            },
            data: {
              balance: {
                increment: commission_amount,
              },
            },
          });

          // create a txn record for that
          await tx.transactions.create({
            data: {
              wallet_id: referrer.wallets.id,
              amount: commission_amount,
              balance: credited_referrer_wallet.balance,
              txn_type: "Credit",
              txn_status: "Completed",
              txn_note: `Commission from ${formateId(
                updated_deposit.id,
                "RD"
              )}`,
            },
          });
        }
      }

      this.notificationService.sendSMS(
        updated_deposit.user.phone,
        templates.Recurring_Deposit_Repayment,
        [
          {
            Key: "customer",
            Value: updated_deposit.user.name,
          },
          {
            Key: "account",
            Value: formateId(updated_deposit.id, "RD"),
          },
          {
            Key: "amount",
            Value: Number(emiRecord.amount).toFixed(2),
          },
          {
            Key: "balance",
            Value: Number(updated_deposit.total_paid).toFixed(2),
          },
          {
            Key: "date",
            Value: format(new Date(), "dd/MM/yyyy"),
          },
        ]
      );
    });

    return {
      status: true,
      message: "EMI Collected Successfully.",
    };
  }

  async assignAgent(depositid: number, agentid: number) {
    await this.databaseService.assignments.create({
      data: {
        agent_id: agentid,
        plan_id: depositid,
        category: "Deposit",
      },
    });

    return {
      status: true,
      message: "Success",
    };
  }

  async unassignAgent(depositid: number, agentid: number) {
    await this.databaseService.assignments.deleteMany({
      where: {
        agent_id: agentid,
        plan_id: depositid,
        category: "Deposit",
      },
    });

    return {
      status: true,
      message: "Success",
    };
  }

  async settlement(userid: number, depositid: number, settle_data) {
    const { settle_type, settle_amount, settle_remark } = settle_data;

    const updated_deposit = await this.databaseService.deposits.update({
      where: {
        id: depositid,
      },
      data: {
        deposit_status:
          settle_type === "premature" ? "PrematureClosed" : "Closed",
        remark: `${settle_remark} | Total Return : ${showAsCurrency(
          Number(settle_amount)
        )} at ${new Date().toDateString()}`,
      },
      include: {
        user: {
          select: {
            name: true,
            phone: true,
          },
        },
      },
    });

    // credit the collected amount to the wallet of the collector
    const wallet = await this.databaseService.wallets.update({
      where: {
        id: userid,
      },
      data: {
        balance: {
          decrement: Number(settle_amount),
        },
      },
    });

    // create a transaction for the collector
    await this.databaseService.transactions.create({
      data: {
        amount: Number(settle_amount),
        balance: wallet.balance,
        txn_type:
          settle_type === "premature" ? "PrematureClosed" : "MatureClosed",
        txn_status: "Completed",
        txn_note: `Deposit settlement of ${formateId(
          updated_deposit.id,
          "RD"
        )}`,
        wallet_id: wallet.id,
      },
    });

    let template = templates.Fixed_Deposit_Maturity;

    if (updated_deposit.category === "RD") {
      template =
        settle_type === "premature"
          ? templates.Recurring_Deposit_Premature
          : templates.Recurring_Deposit_Maturity;
    } else {
      template =
        settle_type === "premature"
          ? templates.Fixed_Deposit_PreMature
          : templates.Fixed_Deposit_Maturity;
    }

    this.notificationService.sendSMS(updated_deposit.user.phone, template, [
      {
        Key: "customer",
        Value: updated_deposit.user.name,
      },
      {
        Key: "account",
        Value: formateId(
          updated_deposit.id,
          updated_deposit.category as "RD" | "FD"
        ),
      },
      {
        Key: "amount",
        Value: settle_amount,
      },
      {
        Key: "date",
        Value: format(new Date(), "dd/MM/yyyy"),
      },
    ]);

    return {
      status: true,
      message: "Deposit Settled Successfully.",
    };
  }

  async updateReferrer(depositid: number, refid: string) {
    const refId = refid.match(/\d*\d/gm);

    const updated_deposit = await this.databaseService.deposits.update({
      where: {
        id: depositid,
      },
      data: {
        ref_id: refId ? parseInt(refId[0]) : undefined,
      },
    });

    return {
      status: true,
      message: updated_deposit,
    };
  }
}
