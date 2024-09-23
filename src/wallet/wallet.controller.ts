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
    const { data: wallet } = await this.walletService.getWalletByUserId(
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

      return {
        status: true,
        data: { ...wallet, company_balance: company_balance._sum.balance },
      };
    }

    return {
      status: true,
      data: wallet,
    };
  }

  @Get("txns")
  transactions(
    @Request() req,
    @Query("limit") limit: string = "10",
    @Query("skip") skip: string = "0"
  ) {
    return this.walletService.findTransactionsByUserId(
      req.user.id,
      limit,
      skip
    );
  }

  @Get("withdrawals")
  withdrawals(
    @Request() req,
    @Query("src") src: string | undefined = undefined,
    @Query("limit") limit: string = "10",
    @Query("skip") skip: string = "0"
  ) {
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

  // @Get(':id/')
  // async findWalletById() {

  // }

  // @Get(':id/txns')
  // async findWalletTransactionById() {
  //   return
  // }

  // @Post('')
  // async makeWalletTransaction() {

  // }
}
