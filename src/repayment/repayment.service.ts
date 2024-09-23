import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { due_record_status, kyc_verifications, Prisma } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { DatabaseService } from "../database/database.service";
import { formateId } from "src/utils/formateId";

@Injectable()
export class RepaymentService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getRepaymentId(id: number) {
    const repayment = await this.databaseService.emi_records.findFirst({
      where: {
        id,
      },
      include: {
        due_emi_config: {
          include: {
            due_record: {
              select: {
                due_date: true,
              },
            },
          },
        },
      },
    });

    return {
      status: true,
      data: repayment,
    };
  }

  async correctRepaymentById(req, id: number, emi_data) {
    const {
      corrected_amount,
      corrected_fee,
      corrected_pay_date,
      corrected_remark,
    } = emi_data;

    const now = new Date();

    let updated_repayment;

    await this.databaseService.$transaction(async (prisma) => {
      const originalEmiRecord = await prisma.emi_records.findUnique({
        where: { id: id },
        include: {
          due_emi_config: {
            orderBy: {
              due_id: "desc",
            },
          },
        },
      });

      if (!originalEmiRecord) {
        throw new BadRequestException("EMI record not found.");
      }

      if (Number(originalEmiRecord.amount) < corrected_amount) {
        throw new BadRequestException(
          "Please create a new collection for the extra amount!"
        );
      }

      if (
        req.user?.role === "Agent" &&
        originalEmiRecord.status !== "Collected"
      ) {
        throw new BadRequestException(
          "EMI record is not in the 'Collected' status"
        );
      }

      let remainingAmount = Number(corrected_amount);
      let remainingFeeAmount = Number(corrected_fee);

      if (originalEmiRecord.category === "Loan") {
        const updatable_due_records = [];

        for (const dueEmiConfig of originalEmiRecord.due_emi_config) {
          const originalDueRecord = await prisma.due_record.findUnique({
            where: { id: dueEmiConfig.due_id },
          });

          if (originalDueRecord) {
            const rollbacked_paid_amount =
              Number(originalDueRecord.paid_amount) -
              Number(dueEmiConfig.amount);
            const rollbacked_paid_fee =
              Number(originalDueRecord.paid_fee) -
              Number(dueEmiConfig.late_fee);

            const amountToPay = Math.min(
              remainingAmount,
              Number(originalDueRecord.emi_amount) -
                Number(rollbacked_paid_amount)
            );
            const totalPaidAmount =
              Number(rollbacked_paid_amount) + amountToPay;

            const feeToPay = Math.min(
              remainingFeeAmount,
              Number(originalDueRecord.late_fee) - Number(rollbacked_paid_fee)
            );
            const totalPaidFee = Number(rollbacked_paid_fee) + feeToPay;

            let status: due_record_status = originalDueRecord.status;

            if (totalPaidAmount >= Number(originalDueRecord.emi_amount)) {
              if (totalPaidFee < Number(originalDueRecord.late_fee)) {
                status = "PartiallyFeed";
              } else {
                status = "Paid";
              }
            } else if (totalPaidAmount > 0) {
              status = "PartiallyPaid";
            } else {
              status = "Due";
            }

            const update_due_record = {
              due_id: originalDueRecord.id,
              paid_amount: totalPaidAmount,
              paid_fee: totalPaidFee,
              pay_date: new Date(
                new Date(corrected_pay_date).setHours(
                  now.getHours(),
                  now.getMinutes(),
                  now.getSeconds()
                )
              ),
              status,
              amount: amountToPay,
              total_paid_amount: totalPaidAmount,
              late_fee: feeToPay,
              total_paid_fee: totalPaidFee,
              emi_id: dueEmiConfig.emi_id,
            };

            updatable_due_records.push(update_due_record);

            remainingAmount -= amountToPay;
            remainingFeeAmount -= feeToPay;
          }
        }

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
      }

      // Update the emi_record with the corrected data
      updated_repayment = await prisma.emi_records.update({
        where: { id: originalEmiRecord.id },
        data: {
          amount: Number(corrected_amount),
          late_fee: Number(corrected_fee),
          pay_date: new Date(
            new Date(corrected_pay_date).setHours(
              now.getHours(),
              now.getMinutes(),
              now.getSeconds()
            )
          ),
          remark: corrected_remark,
          total_paid: {
            decrement: Number(originalEmiRecord.amount) - corrected_amount,
          },
        },
      });

      if (originalEmiRecord.category === "Loan") {
        const updated_loan = await prisma.loans.update({
          where: {
            id: originalEmiRecord.plan_id,
          },
          data: {
            total_paid: {
              decrement:
                Number(originalEmiRecord.amount) - Number(corrected_amount),
            },
          },
        });

        // reopen loan
        if (updated_loan.total_paid < updated_loan.total_payable) {
          await prisma.loans.update({
            where: {
              id: originalEmiRecord.plan_id,
            },
            data: {
              loan_status: "Active",
            },
          });
        }
      } else {
        await prisma.deposits.update({
          where: {
            id: originalEmiRecord.plan_id,
          },
          data: {
            total_paid: {
              decrement:
                Number(originalEmiRecord.amount) - Number(corrected_amount),
            },
          },
        });
      }

      if (["Paid", "Hold"].includes(originalEmiRecord.status)) {
        const collected_by =
          originalEmiRecord.status === "Hold"
            ? 0 //originalEmiRecord.hold_by
            : originalEmiRecord.collected_by;

        // deduct amount from collected_by
        const update_wallet = await prisma.wallets.update({
          where: {
            user_id: Number(collected_by),
          },
          data: {
            balance: {
              decrement:
                Number(originalEmiRecord.amount) -
                Number(corrected_amount) +
                Number(corrected_fee),
            },
          },
        });

        await prisma.transactions.create({
          data: {
            wallet_id: update_wallet.id,
            amount:
              Number(originalEmiRecord.amount) -
              Number(corrected_amount) +
              Number(corrected_fee),
            balance: update_wallet.balance,
            txn_type: "Debit",
            txn_status: "Completed",
            txn_note: `Repayment Correction for loan (${formateId(
              originalEmiRecord.plan_id,
              originalEmiRecord.category as any
            )})`,
          },
        });
      }
    });

    return {
      status: true,
      data: updated_repayment,
      message: "Correction successful",
    };
  }
}
