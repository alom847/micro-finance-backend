import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { Prisma, PrismaClient, transactions_txn_type } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { SettingsService } from "../settings/settings.service";
import { format } from "date-fns";
import { formateId } from "src/utils/formateId";
import {
  NotificationService,
  templates,
} from "src/notification/notification.service";

@Injectable()
export class WalletService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly settingsService: SettingsService,
    private readonly notificationService: NotificationService
  ) {}

  async findTransactionsByUserId(
    userid: number,
    limit: number,
    skip: number,
    filter_from: string | undefined,
    filter_to: string | undefined,
    filter_txn_type: string | undefined
  ) {
    var txns = await this.databaseService.transactions.findMany({
      orderBy: {
        created_at: "desc",
      },
      where: {
        txn_wallet: {
          user_id: userid,
        },
        txn_type: filter_txn_type as transactions_txn_type,
        created_at: {
          gte: filter_from ? new Date(filter_from as string) : undefined,
          lt: filter_to ? new Date(filter_to as string) : undefined,
        },
      },
      take: limit,
      skip: skip,
    });

    const debit = await this.databaseService.transactions.aggregate({
      where: {
        txn_type: {
          in: [
            "Debit",
            "Disburshed",
            "MatureClosed",
            "PrematureClosed",
            "ApprovedWithdrawal",
          ],
        },
        txn_wallet: {
          user_id: userid,
        },
        created_at: {
          gte: filter_from ? new Date(filter_from as string) : undefined,
          lt: filter_to ? new Date(filter_to as string) : undefined,
        },
      },
      _sum: {
        amount: true,
      },
    });

    const credit = await this.databaseService.transactions.aggregate({
      where: {
        txn_type: {
          in: ["Credit", "Settlement"],
        },
        txn_wallet: {
          user_id: userid,
        },
        created_at: {
          gte: filter_from ? new Date(filter_from as string) : undefined,
          lt: filter_to ? new Date(filter_to as string) : undefined,
        },
      },
      _sum: {
        amount: true,
      },
    });

    var total = await this.databaseService.transactions.count({
      where: {
        txn_wallet: {
          user_id: userid,
        },
        txn_type: filter_txn_type as transactions_txn_type,
        created_at: {
          gte: filter_from ? new Date(filter_from as string) : undefined,
          lt: filter_to ? new Date(filter_to as string) : undefined,
        },
      },
    });

    return {
      status: true,
      data: {
        credit: Number(credit._sum.amount),
        debit: Number(debit._sum.amount),
        txns,
        total,
      },
    };
  }

  async initiateWithdrawalRequest(userid: number, withdrawal_amount: number) {
    const amount = Number(withdrawal_amount);

    const { data: MIN_WITHDRAWAL_AMOUNT } =
      await this.settingsService.getSettingByKey("min-withdrawal-amount");
    const { data: MAX_WITHDRAWAL_AMOUNT } =
      await this.settingsService.getSettingByKey("max-withdrawal-amount");

    console.log(MIN_WITHDRAWAL_AMOUNT);
    console.log(MAX_WITHDRAWAL_AMOUNT);

    if (
      amount < Number(MIN_WITHDRAWAL_AMOUNT.value) ||
      amount > Number(MAX_WITHDRAWAL_AMOUNT.value)
    ) {
      return {
        status: false,
        message: `Amount must be in (${MIN_WITHDRAWAL_AMOUNT.value} - ${MAX_WITHDRAWAL_AMOUNT.value}) range.`,
      };
    }

    await this.databaseService.$transaction(async (txn) => {
      const updated_wallet = await txn.wallets.update({
        where: {
          user_id: userid,
        },
        data: {
          balance: {
            decrement: amount,
          },
        },
      });

      const withdrawal = await txn.withdrawals.create({
        data: {
          wallet_id: updated_wallet.id,
          amount: amount,
        },
      });

      await txn.transactions.create({
        data: {
          wallet_id: updated_wallet.id,
          amount: amount,
          balance: updated_wallet.balance,
          txn_type: "Debit",
          txn_note: `Withdrawal initiated - #${withdrawal.id}`,
        },
      });

      if (Number(updated_wallet.balance) < 0) {
        throw new HttpException("Insufficient Balance", HttpStatus.BAD_REQUEST);
      }
    });

    return { status: true, message: "Initiated Withdrawal Request." };
  }

  async findWithdrawalsByUserId(
    userid: number,
    limit: string = "10",
    skip: string = "0"
  ) {
    const withdrawals = await this.databaseService.withdrawals.findMany({
      where: {
        wallet: {
          user_id: userid,
        },
      },
      orderBy: {
        created_at: "desc",
      },
      include: {
        wallet: {
          include: {
            owner: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
        },
      },
      skip: parseInt(skip as string),
      take: parseInt(limit as string),
    });

    const total = await this.databaseService.withdrawals.count({
      where: {
        wallet: {
          user_id: userid,
        },
      },
    });

    return { status: true, data: { withdrawals, total } };
  }

  async findWithdrawals(
    src_term: string | undefined,
    limit: string = "10",
    skip: string = "0"
  ) {
    const search_term_string = (src_term as string)?.match(/^([A-Za-z\s]+)/gm);
    const search_term_number = (src_term as string)?.match(/\d*\d/gm);

    // If src_term is undefined, return all withdrawals
    const whereClause = src_term
      ? {
          OR: [
            {
              id:
                search_term_string?.[0].toLowerCase() === "hmw" &&
                search_term_number
                  ? parseInt(search_term_number[0])
                  : undefined,
            },
            {
              wallet: {
                user_id:
                  search_term_string?.[0].toLowerCase() === "hmu" &&
                  search_term_number
                    ? parseInt(search_term_number[0])
                    : undefined,
              },
            },
            {
              wallet: {
                owner: {
                  OR: [
                    {
                      name: {
                        contains: search_term_string?.[0].toLowerCase(),
                      },
                    },
                    {
                      phone: {
                        contains: search_term_number?.[0],
                      },
                    },
                  ],
                },
              },
            },
          ],
        }
      : {}; // If no search term, whereClause is empty to return all records

    const withdrawals = await this.databaseService.withdrawals.findMany({
      orderBy: {
        created_at: "desc",
      },
      where: whereClause,
      include: {
        wallet: {
          include: {
            owner: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
        },
      },
      skip: parseInt(skip),
      take: parseInt(limit),
    });

    const total = await this.databaseService.withdrawals.count({
      where: whereClause,
    });

    return { status: true, data: { withdrawals, total } };
  }

  async makeTransaction(
    req,
    userid: number,
    amount: number,
    type: string,
    date: string,
    remark: string
  ) {
    const now = new Date();

    await this.databaseService.$transaction(async (prisma) => {
      // update the amount to the wallet
      const user_wallet = await prisma.wallets.update({
        where: {
          user_id: userid,
        },
        data: {
          balance: {
            increment: Number(amount) * (type === "Debit" ? -1 : 1),
          },
        },
        include: {
          owner: {
            select: {
              name: true,
              phone: true,
              role: true,
            },
          },
        },
      });

      // create a transaction for the user
      await prisma.transactions.create({
        data: {
          wallet_id: user_wallet.id,
          amount: amount,
          balance: user_wallet.balance,
          txn_type: type as transactions_txn_type,
          txn_status: "Completed",
          txn_note: `${type}ed by ${req.user.name} (${remark})`,
          created_at: new Date(
            new Date(date).setHours(
              now.getHours(),
              now.getMinutes(),
              now.getSeconds()
            )
          ),
        },
      });

      if (user_wallet.owner.role === "Manager") {
        // update the amount to the wallet
        const admin_wallet = await prisma.wallets.update({
          where: {
            id: req.user.id,
          },
          data: {
            balance: {
              increment: Number(amount) * (type === "Debit" ? 1 : -1),
            },
          },
        });

        // create a transaction for the user
        await prisma.transactions.create({
          data: {
            wallet_id: admin_wallet.id,
            amount: amount,
            balance: admin_wallet.balance,
            txn_type: type === "Debit" ? "Credit" : "Debit",
            txn_status: "Completed",
            txn_note: `${type}ed to ${formateId(
              user_wallet.user_id,
              "User"
            )} - (${remark})`,
            created_at: new Date(
              new Date(date).setHours(
                now.getHours(),
                now.getMinutes(),
                now.getSeconds()
              )
            ),
          },
        });

        if (Number(admin_wallet.balance) < 0) {
          throw new Error(`Insufficient fund to make this transaction`);
        }
      }

      await this.notificationService.sendSMS(
        user_wallet.owner.phone,
        type === "Debit" ? templates.Wallet_Debit : templates.Wallet_Credit,
        [
          {
            Key: "account",
            Value: formateId(user_wallet.user_id, "User"),
          },
          {
            Key: "amount",
            Value: Number(amount).toFixed(2),
          },
          {
            Key: "balance",
            Value: Number(user_wallet.balance).toFixed(2),
          },
          {
            Key: "customer",
            Value: user_wallet.owner.name,
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
      message: "Transaction is successfull!",
    };
  }

  async findWalletByUserId(userid: number) {
    console.log(userid);

    const wallet = await this.databaseService.wallets.findFirst({
      where: {
        user_id: userid,
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    console.log(wallet);

    return {
      status: true,
      data: wallet,
    };
  }

  async approveWithdrawalById(req, id: number, note: string | undefined) {
    await this.databaseService.$transaction(async (prisma) => {
      const updated_withdrawal = await prisma.withdrawals.update({
        where: {
          id: id,
        },
        data: {
          status: "Completed",
          note: note,
        },
        include: {
          wallet: {
            include: {
              owner: {
                select: {
                  name: true,
                  phone: true,
                },
              },
            },
          },
        },
      });

      const updated_wallet = await prisma.wallets.update({
        where: {
          user_id: req.user.id,
        },
        data: {
          balance: {
            decrement: Number(updated_withdrawal.amount),
          },
        },
      });

      if (Number(updated_wallet.balance) < 0) {
        throw new Error(`Insufficient fund to approve withdrawal`);
      }

      await prisma.transactions.create({
        data: {
          wallet_id: updated_wallet.id,
          amount: updated_withdrawal.amount,
          balance: updated_wallet.balance,
          txn_type: "ApprovedWithdrawal",
          txn_note: `Approved Withdrawal Request - #${updated_withdrawal.id}`,
        },
      });

      this.notificationService.sendSMS(
        updated_withdrawal.wallet.owner.phone,
        templates.Withdrawal_Confirmed,
        [
          {
            Key: "customer",
            Value: updated_withdrawal.wallet.owner.name,
          },
          {
            Key: "amount",
            Value: Number(updated_withdrawal.amount).toFixed(2),
          },
          {
            Key: "date",
            Value: format(new Date(), "dd/MM/yyyy"),
          },
          {
            Key: "balance",
            Value: Number(updated_withdrawal.wallet.balance).toFixed(2),
          },
        ]
      );
    });

    return {
      status: true,
      message: "Withdrawal Approved Successfully.",
    };
  }

  async rejectWithdrawalById(id: number, note: string | undefined) {
    const withdrawal = await this.databaseService.withdrawals.update({
      where: {
        id: id,
      },
      data: {
        status: "Rejected",
        note: note,
      },
    });

    const updated_wallet = await this.databaseService.wallets.update({
      where: {
        id: withdrawal.wallet_id,
      },
      data: {
        balance: {
          increment: Number(withdrawal.amount),
        },
      },
      include: {
        owner: {
          select: {
            name: true,
            phone: true,
          },
        },
      },
    });

    await this.databaseService.transactions.create({
      data: {
        wallet_id: updated_wallet.id,
        amount: withdrawal.amount,
        balance: updated_wallet.balance,
        txn_type: "Credit",
        txn_note: `Withdrawal Refunded - #${withdrawal.id}`,
      },
    });

    const resp = await this.notificationService.sendSMS(
      updated_wallet.owner.phone,
      templates.Rejected_Reason,
      [
        {
          Key: "customer",
          Value: updated_wallet.owner.name,
        },
        {
          Key: "reason",
          Value: note as string,
        },
      ]
    );

    console.log(resp);

    return {
      status: true,
      message: "Withdrawal request rejected",
    };
  }
}
