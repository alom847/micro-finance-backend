import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  loans_emi_frequency,
  loans_interest_frequency,
  Prisma,
} from '@prisma/client';
import { DatabaseService } from '../database/database.service';
import { calculateEmi, getTotalPayable } from '../utils/calculateEmi';

@Injectable()
export class LoansService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findLoansByUserId(userid: number, limit: number, skip: number) {
    const loans = await this.databaseService.loans.findMany({
      orderBy: {
        created_at: 'desc',
      },
      where: {
        user_id: userid,
        loan_status: {
          in: ['Active', 'Pending', 'Rejected'],
        },
      },
      take: limit,
      skip: skip,
    });

    const total = await this.databaseService.loans.count({
      where: {
        user_id: userid,
        loan_status: {
          in: ['Active', 'Pending', 'Rejected'],
        },
      },
    });

    return {
      status: true,
      message: {
        loans,
        total,
      },
    };
  }

  async applyForLoan(userid: number, data: any) {
    const pendingExists = await this.databaseService.loans.count({
      where: {
        user_id: userid,
        loan_status: 'Pending',
      },
    });

    if (pendingExists > 0) {
      throw new BadRequestException(
        'You Already have a loan application on pending, please contact Branch.',
      );
    }

    const getPlan = await this.databaseService.loan_plans.findFirst({
      where: {
        id: parseInt(data.plan_id as string),
      },
    });

    if (!getPlan) {
      throw new BadRequestException('Invalid Plan!');
    }

    const emi_amount = calculateEmi(
      parseFloat(data.principal_amount as string),
      Number(getPlan.interest_rate),
      parseInt(data.prefered_installments as string),
      getPlan.interest_frequency,
      getPlan.allowed_emi_frequency as string,
    );

    const total_payable = getTotalPayable(
      parseFloat(data.principal_amount as string),
      Number(getPlan.interest_rate),
      parseInt(data.prefered_installments as string),
      getPlan.interest_frequency,
      getPlan.allowed_emi_frequency as string,
    );

    const refId = (data.referral_id as string).match(/\d*\d/gm);

    await this.databaseService.loans.create({
      data: {
        ref_id: refId ? parseInt(refId[0]) : undefined,
        user_id: userid as number,
        plan_id: getPlan.id,
        amount: parseFloat(data.principal_amount as string),
        total_paid: 0,
        emi_amount: emi_amount,
        total_payable: total_payable,
        interest_rate: getPlan.interest_rate,
        interest_frequency:
          getPlan.interest_frequency as loans_interest_frequency,
        emi_frequency: getPlan.allowed_emi_frequency as loans_emi_frequency,
        prefered_installments: parseInt(data.prefered_installments as string),
        premature_closing_charge: getPlan.premature_closing_charge,
        allow_premature_closing: getPlan.allow_premature_closing,
        guarantor: {
          photo: data.guarantor_photo_url,
          photo_location: data.guarantor_photo_url,
          standard_form: data.standard_form_url,
          standard_form_location: data.standard_form_url,
          name: data.guarantor_name,
          phone: data.guarantor_phone,
          address: data.guarantor_address,
          relationship: data.guarantor_relationship,
        },
      },
    });

    return { status: true, message: 'Loan has been applied successfully' };
  }

  async reapplyLoanByLoanId(userid: number, loanid: number, data: any) {
    const loan_data = await this.databaseService.loans.findFirst({
      where: {
        id: loanid,
        user_id: userid,
      },
    });

    if (!loan_data) throw new BadRequestException('Invalid Loan');

    const emi_amount = calculateEmi(
      parseFloat(data.principal_amount as string),
      Number(loan_data?.interest_rate),
      parseInt(data.prefered_installments as string),
      loan_data?.interest_frequency as string,
      loan_data?.emi_frequency as string,
    );

    const total_payable = getTotalPayable(
      parseFloat(data.principal_amount as string),
      Number(loan_data?.interest_rate),
      parseInt(data.prefered_installments as string),
      loan_data?.interest_frequency as string,
      loan_data?.emi_frequency as string,
    );

    const refId = (data.referral_id as string).match(/\d*\d/gm);

    await this.databaseService.loans.update({
      where: {
        id: loanid,
      },
      data: {
        ref_id: refId ? parseInt(refId[0]) : undefined,
        amount: parseFloat(data.principal_amount as string),
        total_paid: 0,
        emi_amount: emi_amount,
        total_payable: total_payable,
        prefered_installments: parseInt(data.prefered_installments as string),
        guarantor: {
          photo: data.guarantor_photo_url,
          photo_location: data.guarantor_photo_url,
          standard_form: data.standard_form_url,
          standard_form_location: data.standard_form_url,
          name: data.guarantor_name,
          phone: data.guarantor_phone,
          address: data.guarantor_address,
          relationship: data.guarantor_relationship,
        },
        remark: '',
        loan_status: 'Pending',
      },
    });

    return { status: true, message: 'Loan has been applied successfully' };
  }

  async findUserLoanById(userid: number, loanid: number) {
    const loan = await this.databaseService.loans.findFirst({
      where: {
        id: loanid,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
            phone: true,
          },
        },
        loan_plan: {
          select: {
            plan_name: true,
            interest_rate: true,
            allow_premature_closing: true,
            premature_closing_charge: true,
            allowed_emi_frequency: true,
            interest_frequency: true,
            penalty_rate: true,
          },
        },
      },
    });

    if (!loan) throw new BadRequestException('invalid loan');

    const next_pay_date = await this.databaseService.due_record.findFirst({
      orderBy: {
        due_date: 'asc',
      },
      where: {
        plan_id: loan?.id,
        category: 'Loan',
        status: 'Due',

        due_date: {
          gt: new Date(new Date().setHours(0, 0, 0)),
        },
      },
    });

    const emi_paid = await this.databaseService.due_record.count({
      where: {
        plan_id: loan?.id,
        category: 'Loan',
        status: {
          in: ['Paid', 'PartiallyFeed'],
        },
      },
    });

    return {
      status: true,
      data: {
        loan: {
          ...loan,
          next_pay_date: next_pay_date?.due_date,
          emi_paid,
        },
      },
    };
  }

  async findUserLoanDueById(userid: number, loanid: number) {
    const loan = await this.databaseService.loans.findFirst({
      where: {
        id: loanid,
      },
      include: {
        loan_plan: {
          select: {
            penalty_rate: true,
          },
        },
      },
    });

    if (!loan) throw new BadRequestException('invalid loan');

    // const late_fee =
    //   Number(loan?.emi_amount) * (Number(loan?.loan_plan.penalty_rate) / 100);
    // const freq =
    //   payment_frequency[loan?.emi_frequency as loans_emi_frequency];

    const tommorow = new Date();
    tommorow.setHours(0, 0, 0);
    tommorow.setDate(tommorow.getDate() + 1);

    const [overdues, partial_dues, dues] = await Promise.all([
      this.databaseService.due_record.findMany({
        orderBy: { due_date: 'desc' },
        where: { category: 'Loan', plan_id: loan.id, status: 'Overdue' },
      }),
      this.databaseService.due_record.findMany({
        orderBy: { due_date: 'desc' },
        where: {
          category: 'Loan',
          plan_id: loan.id,
          status: { in: ['PartiallyPaid', 'PartiallyFeed'] },
          due_date: { lt: tommorow },
        },
      }),
      this.databaseService.due_record.findMany({
        orderBy: { due_date: 'desc' },
        where: {
          category: 'Loan',
          plan_id: loan.id,
          status: 'Due',
          due_date: { lt: tommorow },
        },
      }),
    ]);

    // const updated_overdues = [];

    // for (let i = 0; i < overdues.length; i++) {
    //   const differenceInMilliseconds =
    //     new Date().getTime() - new Date(overdues[i].due_date).getTime();
    //   const differenceInDays = Math.floor(
    //     differenceInMilliseconds / (1000 * 60 * 60 * 24)
    //   );
    //   const estimated_fee = Math.floor(differenceInDays / freq) * late_fee;

    //   const updated_due = await db.due_record.update({
    //     where: {
    //       id: overdues[i].id,
    //     },
    //     data: {
    //       late_fee: estimated_fee,
    //     },
    //   });

    //   updated_overdues.push(updated_due);
    // }

    // const updated_partial_dues = [];

    // for (let i = 0; i < partiallyPaid.length; i++) {
    //   const differenceInMilliseconds =
    //     new Date().getTime() - new Date(partiallyPaid[i].due_date).getTime();
    //   const differenceInDays = Math.floor(
    //     differenceInMilliseconds / (1000 * 60 * 60 * 24)
    //   );
    //   const estimated_fee = Math.floor(differenceInDays / freq) * late_fee;

    //   const updated_due = await db.due_record.update({
    //     where: {
    //       id: partiallyPaid[i].id,
    //     },
    //     data: {
    //       late_fee: estimated_fee,
    //     },
    //   });

    //   updated_partial_dues.push(updated_due);
    // }

    // const overdueLateFee = updated_overdues.reduce((prv_due, cur_due) => {
    //   return prv_due + (Number(cur_due.late_fee) - Number(cur_due.paid_fee));
    // }, 0);

    // const partialLateFee = partiallyPaid.reduce((prv_due, cur_due) => {
    //   return prv_due + (Number(cur_due.late_fee) - Number(cur_due.paid_fee));
    // }, 0);

    // const totalLateFee = overdueLateFee + partialLateFee;

    // when late fee will be introduced use updated_overdues
    const totalOverdue = overdues.reduce(
      (total, due) => total + Number(due.emi_amount),
      0,
    );
    // when late fee will be introduced use updated_partial_dues
    const totalPartialRemain = partial_dues.reduce(
      (total, due) =>
        total + (Number(due.emi_amount) - Number(due.paid_amount)),
      0,
    );

    const totalDue = dues.reduce(
      (total, due) => total + Number(due.emi_amount),
      0,
    );

    return {
      status: true,
      data: {
        overdues: overdues,
        partiallyPaid: partial_dues,
        dues,
        totalOverdue,
        totalPartialRemain,
        totalDue,
        totalLateFee: 0,
      },
    };
  }

  async findUserLoanRepaymentsById(
    userid: number,
    loanid: number,
    limit: number,
    skip: number,
  ) {
    const repayments = await this.databaseService.emi_records.findMany({
      orderBy: {
        pay_date: 'desc',
      },
      where: {
        plan_id: loanid,
        category: 'Loan',
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
        plan_id: loanid,
        category: 'Loan',
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

  async findAssignedAgentsByLoanId(loanid: number, agentid: string) {
    const agents = await this.databaseService.assignments.findMany({
      where: {
        plan_id: loanid,
        category: 'Loan',
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

    const agentId = agentid.match(/\d*\d/gm);

    // agentId ? parseInt(agentId[0]) : undefined
    const available_agents = await this.databaseService.user.findMany({
      where: {
        id: agentId ? parseInt(agentId[0]) : undefined,
        role: 'Agent',
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
