import {
  Controller,
  Get,
  Post,
  Request,
  Query,
  Body,
  UseGuards,
  Param,
  ParseIntPipe,
  UnauthorizedException,
  Put,
  Response,
  BadRequestException,
} from "@nestjs/common";
import { WalletService } from "./wallet.service";
import { AuthGuard } from "../auth/auth.guard";
import { DatabaseService } from "../database/database.service";

@UseGuards(AuthGuard)
@Controller("wallet")
export class WalletController {
  constructor(
    private readonly walletService: WalletService,
    private readonly databaseService: DatabaseService
  ) {}

  @Get()
  async wallet(@Request() req) {
    const { data: wallet } = await this.walletService.findWalletByUserId(
      req.user.id
    );

    if (["Admin", "Manager"].includes(req.user.role ?? "")) {
      const company_balance = await this.databaseService.wallets.aggregate({
        where: {
          owner: {
            role: { in: ["Admin", "Manager"] },
          },
        },
        _sum: {
          balance: true,
        },
      });

      const wallets = await this.databaseService.wallets.findMany({
        where: {
          owner: {
            role: { in: ["Admin", "Manager"] },
          },
        },
        select: {
          id: true,
          balance: true,
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
        data: {
          ...wallet,
          wallets,
          company_balance: company_balance._sum.balance,
        },
      };
    }

    return {
      status: true,
      data: wallet,
    };
  }

  @Get("txns")
  async txns(
    @Request() req,
    @Query("limit") limit: string | undefined = "10",
    @Query("skip") skip: string | undefined = "0",
    @Query("filter_from") filter_from: string | undefined = undefined,
    @Query("filter_to") filter_to: string | undefined = undefined,
    @Query("filter_txn_type")
    filter_txn_type: string | undefined
  ) {
    return this.walletService.findTransactionsByUserId(
      req.user.id,
      parseInt(limit),
      parseInt(skip),
      filter_from,
      filter_to,
      filter_txn_type
    );
  }

  @Get("withdrawals")
  withdrawals(
    @Request() req,
    @Query("src") src: string | undefined = undefined,
    @Query("limit") limit: string = "10",
    @Query("skip") skip: string = "0"
  ) {
    if (["Admin", "Manager"].includes(req.user.role ?? "")) {
      return this.walletService.findWithdrawals(src, limit, skip);
    }

    return this.walletService.findWithdrawalsByUserId(req.user.id, limit, skip);
  }

  @Post("withdrawal")
  async initiateWithdrawal(@Request() req, @Body() body) {
    if (!req.user.ac_status) {
      throw new BadRequestException("your account is not active.");
    }

    // const user = await this.databaseService.user.findFirst({
    //   where: {
    //     id: req.user.id,
    //   },
    // });

    // if (!(await bcrypt.compare(body.password, user.password))) {
    //   throw new UnauthorizedException('invalid credentials');
    // }

    return this.walletService.initiateWithdrawalRequest(
      req.user.id,
      body.withdrawal_amount
    );
  }

  @Post("withdrawals/approve")
  async approveWithdrawalById(@Request() req, @Body() body) {
    if (!["Admin", "Manager"].includes(req.user.role)) {
      throw new BadRequestException("Unauthorized");
    }

    return this.walletService.approveWithdrawalById(req, body.id, body.note);
  }

  @Post("withdrawals/reject")
  async rejectWithdrawalById(@Request() req, @Body() body) {
    if (!["Admin", "Manager"].includes(req.user.role)) {
      throw new BadRequestException("Unauthorized");
    }

    return this.walletService.rejectWithdrawalById(body.id, body.note);
  }

  @Get(":id")
  async findWalletById(@Param("id", ParseIntPipe) id) {
    return this.walletService.findWalletByUserId(id);
  }

  @Get(":id/txns")
  async findWalletTransactionByUserId(
    @Param("id", ParseIntPipe) id,
    @Query("limit") limit: string | undefined = "10",
    @Query("skip") skip: string | undefined = "0",
    @Query("filter_from") filter_from: string | undefined = undefined,
    @Query("filter_to") filter_to: string | undefined = undefined,
    @Query("filter_txn_type")
    filter_txn_type: string | undefined
  ) {
    return this.walletService.findTransactionsByUserId(
      id,
      parseInt(limit),
      parseInt(skip),
      filter_from,
      filter_to,
      filter_txn_type
    );
  }

  @Post(":id/make-txn")
  async makeWalletTransaction(
    @Request() req,
    @Param("id", ParseIntPipe) id,
    @Body() body
  ) {
    return this.walletService.makeTransaction(
      req,
      id,
      body.amount,
      body.type,
      body.date,
      body.remark
    );
  }
}
