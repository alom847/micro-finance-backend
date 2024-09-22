import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class WalletService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly settingsService: SettingsService,
  ) {}

  async getWalletByUserId(id: number) {
    const wallet = await this.databaseService.wallets.findFirst({
      where: {
        user_id: id,
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

    return { status: true, data: wallet };
  }

  async findTransactionsByUserId(
    userid: number,
    limit: string = '10',
    skip: string = '0',
  ) {
    const transactions = await this.databaseService.transactions.findMany({
      where: {
        txn_wallet: {
          user_id: userid,
        },
      },
      orderBy: {
        created_at: 'desc',
      },
      take: parseInt(limit),
      skip: parseInt(skip),
    });

    const total = await this.databaseService.transactions.count({
      where: {
        txn_wallet: {
          user_id: userid,
        },
      },
    });

    return { status: true, data: { txns: transactions, total } };
  }

  async initiateWithdrawalRequest(userid: number, withdrawal_amount: number) {
    const amount = Number(withdrawal_amount);

    const { data: MIN_WITHDRAWAL_AMOUNT } =
      await this.settingsService.getSettingByKey('min_withdraw_amount');
    const { data: MAX_WITHDRAWAL_AMOUNT } =
      await this.settingsService.getSettingByKey('max_withdraw_amount');

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
          txn_type: 'Debit',
          txn_note: `Withdrawal initiated - #${withdrawal.id}`,
        },
      });

      if (Number(updated_wallet.balance) < 0) {
        throw new HttpException('Insufficient Balance', HttpStatus.BAD_REQUEST);
      }
    });

    return { status: true, data: 'Initiated Withdrawal Request.' };
  }

  async findWithdrawalsByUserId(
    userid: number,
    src_term: string,
    limit: string = '10',
    skip: string = '0',
  ) {
    const search_term_string = (src_term as string).match(/^([A-Za-z\s]+)/gm);
    const search_term_number = (src_term as string).match(/\d*\d/gm);

    const withdrawals = await this.databaseService.withdrawals.findMany({
      where: {
        wallet: {
          user_id: userid,
        },
        id: search_term_string
          ? search_term_string[0].toLowerCase() === 'hmw'
            ? search_term_number
              ? parseInt(search_term_number[0])
              : undefined
            : undefined
          : undefined,
      },
      orderBy: {
        created_at: 'desc',
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
          ? search_term_string[0].toLowerCase() === 'hmw'
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
    limit: string = '10',
    skip: string = '0',
  ) {
    const withdrawals = await this.databaseService.withdrawals.findMany({
      orderBy: {
        created_at: 'desc',
      },
      where: {
        status: status
          ? status === 'All'
            ? undefined
            : (status as 'Pending' | 'Completed')
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
          ? status === 'All'
            ? undefined
            : (status as 'Pending' | 'Completed')
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
    userid: number,
    amount: number,
    action: 'Debit' | 'Credit',
    note: string,
    franchiseCode: string | undefined,
  ) {
    const wallet = await this.databaseService.wallets.update({
      where: {
        user_id: userid,
      },
      data: {
        balance: {
          increment: action === 'Credit' ? amount : amount * -1,
        },
        transactions: {
          create: {
            amount: amount,
            txn_type: action,
            txn_status: 'Completed',
            txn_note: note || 'made by admin',
          },
        },
      },
    });

    return { status: true, data: wallet };
  }
}
