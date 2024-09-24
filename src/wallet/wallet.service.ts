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

    return { status: true, data: "Initiated Withdrawal Request." };
  }

  async findWithdrawalsByUserId(
    userid: number,
    src_term: string,
    limit: string = "10",
    skip: string = "0"
  ) {
    const search_term_string = (src_term as string).match(/^([A-Za-z\s]+)/gm);
    const search_term_number = (src_term as string).match(/\d*\d/gm);

    const withdrawals = await this.databaseService.withdrawals.findMany({
      where: {
        wallet: {
          user_id: userid,
        },
        id: search_term_string
          ? search_term_string[0].toLowerCase() === "hmw"
            ? search_term_number
              ? parseInt(search_term_number[0])
              : undefined
            : undefined
          : undefined,
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
        id: search_term_string
          ? search_term_string[0].toLowerCase() === "hmw"
            ? search_term_number
              ? parseInt(search_term_number[0])
              : undefined
            : undefined
          : undefined,
      },
    });

    return { status: true, data: { withdrawals, total } };
  }

  async findWithdrawals(
    src: string | undefined,
    status: string | undefined,
    from: string | undefined,
    to: string | undefined,
    limit: string = "10",
    skip: string = "0"
  ) {
    const withdrawals = await this.databaseService.withdrawals.findMany({
      orderBy: {
        created_at: "desc",
      },
      where: {
        status: status
          ? status === "All"
            ? undefined
            : (status as "Pending" | "Completed")
          : undefined,
        created_at: {
          gte: from ? new Date(new Date(from).setHours(0, 0, 0)) : undefined,
          lte: to ? new Date(new Date(to).setHours(23, 59, 59)) : undefined,
        },
      },
      include: {
        wallet: {
          select: {
            owner: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      take: parseInt(limit),
      skip: parseInt(skip),
    });

    const total = await this.databaseService.withdrawals.count({
      where: {
        status: status
          ? status === "All"
            ? undefined
            : (status as "Pending" | "Completed")
          : undefined,
        created_at: {
          gte: from ? new Date(new Date(from).setHours(0, 0, 0)) : undefined,
          lte: to ? new Date(new Date(to).setHours(23, 59, 59)) : undefined,
        },
      },
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
          id: userid,
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

    return {
      status: true,
      data: wallet,
    };
  }
}
