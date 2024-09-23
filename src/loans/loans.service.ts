import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  due_record_status,
  loans_emi_frequency,
  loans_interest_frequency,
  Prisma,
} from "@prisma/client";
import { DatabaseService } from "../database/database.service";
import { calculateEmi, getTotalPayable } from "../utils/calculateEmi";
import { formateId } from "src/utils/formateId";
import {
  NotificationService,
  templates,
} from "src/notification/notification.service";
import { format } from "date-fns";

@Injectable()
export class LoansService {
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

  async findLoansByUserId(userid: number, limit: number, skip: number) {
    const loans = await this.databaseService.loans.findMany({
      orderBy: {
        created_at: "desc",
      },
      where: {
        user_id: userid,
        loan_status: {
          in: ["Active", "Pending", "Rejected"],
        },
      },
      take: limit,
      skip: skip,
    });

    const total = await this.databaseService.loans.count({
      where: {
        user_id: userid,
        loan_status: {
          in: ["Active", "Pending", "Rejected"],
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
        loan_status: "Pending",
      },
    });

    if (pendingExists > 0) {
      throw new BadRequestException(
        "You Already have a loan application on pending, please contact Branch."
      );
    }

    const getPlan = await this.databaseService.loan_plans.findFirst({
      where: {
        id: parseInt(data.plan_id as string),
      },
    });

    if (!getPlan) {
      throw new BadRequestException("Invalid Plan!");
    }

    const emi_amount = calculateEmi(
      parseFloat(data.principal_amount as string),
      Number(getPlan.interest_rate),
      parseInt(data.prefered_installments as string),
      getPlan.interest_frequency,
      getPlan.allowed_emi_frequency as string
    );

    const total_payable = getTotalPayable(
      parseFloat(data.principal_amount as string),
      Number(getPlan.interest_rate),
      parseInt(data.prefered_installments as string),
      getPlan.interest_frequency,
      getPlan.allowed_emi_frequency as string
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

    return { status: true, message: "Loan has been applied successfully" };
  }

  async reapplyLoanByLoanId(userid: number, loanid: number, data: any) {
    const loan_data = await this.databaseService.loans.findFirst({
      where: {
        id: loanid,
        user_id: userid,
      },
    });

    if (!loan_data) throw new BadRequestException("Invalid Loan");

    const emi_amount = calculateEmi(
      parseFloat(data.principal_amount as string),
      Number(loan_data?.interest_rate),
      parseInt(data.prefered_installments as string),
      loan_data?.interest_frequency as string,
      loan_data?.emi_frequency as string
    );

    const total_payable = getTotalPayable(
      parseFloat(data.principal_amount as string),
      Number(loan_data?.interest_rate),
      parseInt(data.prefered_installments as string),
      loan_data?.interest_frequency as string,
      loan_data?.emi_frequency as string
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
        remark: "",
        loan_status: "Pending",
      },
    });

    return { status: true, message: "Loan has been applied successfully" };
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

    if (!loan) throw new BadRequestException("invalid loan");

    const next_pay_date = await this.databaseService.due_record.findFirst({
      orderBy: {
        due_date: "asc",
      },
      where: {
        plan_id: loan?.id,
        category: "Loan",
        status: "Due",

        due_date: {
          gt: new Date(new Date().setHours(0, 0, 0)),
        },
      },
    });

    const emi_paid = await this.databaseService.due_record.count({
      where: {
        plan_id: loan?.id,
        category: "Loan",
        status: {
          in: ["Paid", "PartiallyFeed"],
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

    if (!loan) throw new BadRequestException("invalid loan");

    // const late_fee =
    //   Number(loan?.emi_amount) * (Number(loan?.loan_plan.penalty_rate) / 100);
    // const freq =
    //   payment_frequency[loan?.emi_frequency as loans_emi_frequency];

    const tommorow = new Date();
    tommorow.setHours(0, 0, 0);
    tommorow.setDate(tommorow.getDate() + 1);

    const [overdues, partial_dues, dues] = await Promise.all([
      this.databaseService.due_record.findMany({
        orderBy: { due_date: "desc" },
        where: { category: "Loan", plan_id: loan.id, status: "Overdue" },
      }),
      this.databaseService.due_record.findMany({
        orderBy: { due_date: "desc" },
        where: {
          category: "Loan",
          plan_id: loan.id,
          status: { in: ["PartiallyPaid", "PartiallyFeed"] },
          due_date: { lt: tommorow },
        },
      }),
      this.databaseService.due_record.findMany({
        orderBy: { due_date: "desc" },
        where: {
          category: "Loan",
          plan_id: loan.id,
          status: "Due",
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

    //   const updated_due = await this.databaseService.due_record.update({
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

    //   const updated_due = await this.databaseService.due_record.update({
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
      0
    );
    // when late fee will be introduced use updated_partial_dues
    const totalPartialRemain = partial_dues.reduce(
      (total, due) =>
        total + (Number(due.emi_amount) - Number(due.paid_amount)),
      0
    );

    const totalDue = dues.reduce(
      (total, due) => total + Number(due.emi_amount),
      0
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
    skip: number
  ) {
    const repayments = await this.databaseService.emi_records.findMany({
      orderBy: {
        pay_date: "desc",
      },
      where: {
        plan_id: loanid,
        category: "Loan",
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
        category: "Loan",
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
        category: "Loan",
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

  async ApproveLoanById(userid: number, loanid: number) {
    await this.databaseService.$transaction(async (prisma) => {
      // // set status to active if admin else approved.
      const data = await prisma.loans.update({
        where: {
          id: loanid,
        },
        data: {
          loan_status: "Active",
        },
      });

      const approver_wallet = await prisma.wallets.update({
        where: {
          user_id: userid,
        },
        data: {
          balance: {
            decrement: data.amount,
          },
        },
      });

      if (Number(approver_wallet.balance) < 0) {
        throw new Error(`Insufficient fund to approve.`);
      }

      const pay_freq = this.payment_frequency[data.emi_frequency];
      const start_date = data?.loan_date
        ? new Date(data.loan_date)
        : new Date();
      const maturity_date = new Date(start_date);

      maturity_date.setDate(
        maturity_date.getDate() +
          pay_freq * (data.overrode_installments ?? data.prefered_installments)
      );

      const repayment_schedule = [];

      for (
        let i = 1;
        i < (data.overrode_installments ?? data.prefered_installments) + 1;
        i++
      ) {
        const next_pay_date = new Date(
          new Date(start_date).setDate(start_date.getDate() + i * pay_freq)
        );

        repayment_schedule.push({
          plan_id: data.id,
          emi_amount: data.emi_amount,
          due_date: next_pay_date,
        });
      }

      await prisma.due_record.createMany({
        data: repayment_schedule,
      });

      // set Next Pay Date, Maturity Date, Loan Date
      const loan_data = await prisma.loans.update({
        where: {
          id: loanid,
        },
        data: {
          // next_pay_date: next_pay_date,
          maturity_date: maturity_date,
        },
        include: {
          user: {
            select: {
              name: true,
              phone: true,
              image: true,
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
            },
          },
        },
      });

      await prisma.transactions.create({
        data: {
          wallet_id: approver_wallet.id,
          amount: loan_data.amount,
          balance: approver_wallet.balance,
          txn_type: "Disburshed",
          txn_note: `Loan disburshed (${formateId(loanid, "Loan")})`,
        },
      });

      this.notificationService.sendSMS(
        loan_data.user.phone,
        templates.Loan_Approved_Confirmation,
        [
          {
            Key: "customer",
            Value: loan_data.user.name,
          },
          {
            Key: "account",
            Value: formateId(loan_data.id, "Loan"),
          },
          {
            Key: "emi",
            Value: loan_data.total_payable.toFixed(2),
          },
        ]
      );
    });

    return {
      status: true,
      data: "Loan has been approved successfully",
    };
  }

  async RejectLoanById(userid: number, loanid: number, remark: string) {
    const loan_data = await this.databaseService.loans.update({
      where: {
        id: loanid,
      },
      data: {
        loan_status: "Rejected",
        amount: 0,
        total_payable: 0,
        emi_amount: 0,
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
        loan_plan: {
          select: {
            plan_name: true,
            interest_rate: true,
            allow_premature_closing: true,
            premature_closing_charge: true,
            allowed_emi_frequency: true,
            interest_frequency: true,
          },
        },
      },
    });

    this.notificationService.sendSMS(
      loan_data.user.phone,
      templates.Rejected_Reason,
      [
        {
          Key: "customer",
          Value: loan_data.user.name,
        },
        {
          Key: "reason",
          Value: loan_data.remark as string,
        },
      ]
    );

    return {
      status: true,
      data: loan_data,
    };
  }

  async collectRepayment(req, loanid: number, emi_data) {
    const { total_paid, total_fee_paid, pay_date, remark } = emi_data;

    let remainingAmount = Number(total_paid);
    let remainingFeeAmount = Number(total_fee_paid);

    if (remainingAmount <= 0) {
      throw new BadRequestException("Invalid Collection Amount.");
    }

    const dueRecords = await this.databaseService.due_record.findMany({
      where: {
        plan_id: loanid,
        status: { not: "Paid" },
        category: "Loan",
      },
      select: {
        id: true,
        emi_amount: true,
        paid_amount: true,
        late_fee: true,
        paid_fee: true,
        status: true,
      },
      orderBy: {
        due_date: "asc",
      },
    });

    const totalPayable = dueRecords.reduce((total, dueRecord) => {
      return (
        total + Number(dueRecord.emi_amount) - Number(dueRecord.paid_amount)
      );
    }, 0);

    const totalLateFee = dueRecords.reduce((total, dueRecord) => {
      return total + (Number(dueRecord.late_fee) - Number(dueRecord.paid_fee));
    }, 0);

    const isLoanShouldClose =
      remainingAmount >= totalPayable && remainingFeeAmount >= totalLateFee;

    const updated_loan = await this.databaseService.loans.update({
      where: {
        id: loanid,
      },
      data: {
        total_paid: {
          increment: Number(total_paid),
        },
        loan_status: isLoanShouldClose ? "Closed" : undefined,
        last_repayment: new Date(pay_date),
      },
      include: {
        user: {
          select: {
            name: true,
            phone: true,
          },
        },
        loan_plan: {
          select: {
            commission_rate: true,
          },
        },
      },
    });

    const now = new Date();

    const emiRecord = await this.databaseService.emi_records.create({
      data: {
        plan_id: loanid,
        category: "Loan",
        amount: Number(total_paid),
        late_fee: Number(total_fee_paid),
        total_paid: updated_loan.total_paid,
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

    const updatable_due_records = [];

    for (const dueRecord of dueRecords) {
      const emiAmount = Number(dueRecord.emi_amount);
      const paidAmount = Number(dueRecord.paid_amount);
      const lateFee = Number(dueRecord.late_fee);
      const paidFee = Number(dueRecord.paid_fee);

      const amountToPay = Math.min(remainingAmount, emiAmount - paidAmount);
      const totalPaidAmount = paidAmount + amountToPay;

      const feeToPay = Math.min(remainingFeeAmount, lateFee - paidFee); // 10 - 5
      const totalPaidFee = paidFee + feeToPay; // 5 + 5

      let status: due_record_status = dueRecord.status;

      if (totalPaidAmount >= emiAmount) {
        if (totalPaidFee < lateFee) {
          status = "PartiallyFeed";
        } else {
          status = "Paid";
        }
      } else if (totalPaidAmount > 0) {
        status = "PartiallyPaid";
      }

      const update_due_record = {
        due_id: dueRecord.id,
        paid_amount: totalPaidAmount,
        paid_fee: totalPaidFee,
        pay_date: pay_date,
        status,
        amount: amountToPay,
        total_paid_amount: totalPaidAmount,
        late_fee: feeToPay,
        total_paid_fee: totalPaidFee,
        emi_id: emiRecord.id,
      };

      // update_due_record();
      updatable_due_records.push(update_due_record);

      // axios.post(
      //   `${protocol}://${req.headers.host}/api/admin/loans/${id}/update-due`,
      //   {
      //     due_data: update_due_record,
      //   }
      // );

      remainingAmount -= amountToPay;
      remainingFeeAmount -= feeToPay;

      if (remainingAmount <= 0 && remainingFeeAmount <= 0) {
        break;
      }
    }

    // push all emi to queue worker
    for (const due_data of updatable_due_records) {
      await this.databaseService.due_record.update({
        where: { id: due_data.due_id },
        data: {
          paid_amount: due_data.paid_amount,
          paid_fee: due_data.paid_fee,
          pay_date: new Date(
            new Date(due_data.pay_date).setHours(
              now.getHours(),
              now.getMinutes(),
              now.getSeconds()
            )
          ),
          status: due_data.status,
          due_emi_config: {
            upsert: {
              where: {
                due_id_emi_id: {
                  due_id: due_data.due_id,
                  emi_id: due_data.emi_id,
                },
              },
              update: {
                amount: due_data.amount,
                total_paid_amount: due_data.total_paid_amount,
                late_fee: due_data.late_fee,
                total_paid_fee: due_data.total_paid_fee,

                emi_id: due_data.emi_id,
              },
              create: {
                amount: due_data.amount,
                total_paid_amount: due_data.total_paid_amount,
                late_fee: due_data.late_fee,
                total_paid_fee: due_data.total_paid_fee,

                emi_id: due_data.emi_id,
              },
            },
          },
        },
      });
    }

    // await axios.post(`${process.env.QUEUE_WORKER_API_ENDPOINT}/addJobs`, {
    //   jobs: updatable_due_records,
    // });

    // Promise.all(
    //   updatable_due_records.map((due_record_mutation) => {
    //     return due_record_mutation();
    //   })
    // );

    if (["Admin", "Manager"].includes(req.user.role ?? "")) {
      const update_wallet = await this.databaseService.wallets.update({
        where: {
          user_id: req.user.id,
        },
        data: {
          balance: {
            increment: Number(total_paid) + Number(total_fee_paid),
          },
        },
      });

      await this.databaseService.transactions.create({
        data: {
          wallet_id: update_wallet.id,
          amount: Number(total_paid),
          fee: Number(total_fee_paid),
          balance: update_wallet.balance,
          txn_type: "Credit",
          txn_status: "Completed",
          txn_note: `Repayment from loan (${formateId(
            updated_loan.id,
            "Loan"
          )})`,
        },
      });
    }

    if (updated_loan.ref_id) {
      // calculate the commision amount
      const commission_amount =
        (Number(total_paid) / 100) *
        Number(updated_loan.loan_plan.commission_rate);

      // get the wallet info of referrer
      const referrer = await this.databaseService.user.findFirst({
        where: {
          id: Number(updated_loan.ref_id),
        },
        include: {
          wallets: true,
        },
      });

      if (referrer && commission_amount > 0) {
        if (!referrer.wallets) return;
        // credit the commission amount to referrer
        const credited_referrer_wallet =
          await this.databaseService.wallets.update({
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
        await this.databaseService.transactions.create({
          data: {
            wallet_id: referrer.wallets.id,
            amount: commission_amount,
            balance: credited_referrer_wallet.balance,
            txn_type: "Credit",
            txn_status: "Completed",
            txn_note: `Repayment Commission from ${formateId(
              updated_loan.id,
              "Loan"
            )}`,
          },
        });
      }
    }

    this.notificationService.sendSMS(
      updated_loan.user.phone,
      templates.Loan_Repayment,
      [
        {
          Key: "customer",
          Value: updated_loan.user.name,
        },
        {
          Key: "account",
          Value: formateId(updated_loan.id, "Loan"),
        },
        {
          Key: "amount",
          Value: emiRecord.amount.toFixed(2),
        },
        {
          Key: "date",
          Value: format(new Date(), "dd/MM/yyyy"),
        },
        {
          Key: "due",
          Value: (
            Number(updated_loan.total_payable) - Number(updated_loan.total_paid)
          ).toFixed(2),
        },
      ]
    );

    if (isLoanShouldClose) {
      this.notificationService.sendSMS(
        updated_loan.user.phone,
        templates.Loan_Closed_Confirmation,
        [
          {
            Key: "customer",
            Value: updated_loan.user.name,
          },
          {
            Key: "account",
            Value: formateId(updated_loan.id, "Loan"),
          },
          {
            Key: "date",
            Value: `${new Date()
              .toLocaleDateString("en-US", { timeZone: "IST" })
              .split("/")
              .sort(function (a: any, b: any) {
                return a - b;
              })
              .join("/")} - ${new Date().toLocaleTimeString("en-US", {
              timeZone: "IST",
            })}`,
          },
        ]
      );
    }

    return {
      status: true,
      message: "EMI Collected Successfully.",
    };
  }

  async assignAgent(loanid: number, agentid: number) {
    await this.databaseService.assignments.create({
      data: {
        agent_id: agentid,
        plan_id: loanid,
        category: "Loan",
      },
    });

    return {
      status: true,
      message: "Success",
    };
  }

  async unassignAgent(loanid: number, agentid: number) {
    await this.databaseService.assignments.deleteMany({
      where: {
        agent_id: agentid,
        plan_id: loanid,
        category: "Loan",
      },
    });

    return {
      status: true,
      message: "Success",
    };
  }

  async settlement(userid: number, loanid: number, settle_data) {
    const { settle_fee, settle_amount, settle_date, settle_remark } =
      settle_data;

    await this.databaseService.emi_records.create({
      data: {
        plan_id: loanid,
        amount: Number(settle_amount),
        late_fee: Number(settle_fee),
        pay_date: new Date(settle_date),
        category: "Loan",
        status: "Paid",
        collected_by: userid,
        remark: "Loan Settlement",
      },
    });

    // Update the total paid amount
    const updated_loan = await this.databaseService.loans.update({
      where: {
        id: loanid,
      },
      data: {
        total_paid: {
          increment: Number(settle_amount),
        },
        loan_status: "Settlement",
        remark: `${settle_remark} | settled at - ${new Date(
          settle_date
        ).toDateString()}`,
      },
    });

    // credit the collected amount to the wallet of the collector
    const wallet = await this.databaseService.wallets.update({
      where: {
        id: userid,
      },
      data: {
        balance: {
          increment: Number(settle_amount),
        },
      },
    });

    // create a transaction for the collector
    await this.databaseService.transactions.create({
      data: {
        amount: Number(settle_amount),
        balance: wallet.balance,
        txn_type: "Credit",
        txn_status: "Completed",
        txn_note: `Loan settlement of ${formateId(updated_loan.id, "Loan")}`,
        wallet_id: wallet.id,
      },
    });

    return {
      status: true,
      message: "Success",
    };
  }

  async updateReferrer(loanid: number, refid: string) {
    const refId = refid.match(/\d*\d/gm);

    const updated_loan = await this.databaseService.loans.update({
      where: {
        id: loanid,
      },
      data: {
        ref_id: refId ? parseInt(refId[0]) : undefined,
      },
    });

    return {
      status: true,
      message: updated_loan,
    };
  }
}
