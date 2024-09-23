import {
  Controller,
  Get,
  Body,
  Patch,
  Post,
  Req,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";

import { ReportService } from "./report.service";
import { AuthGuard } from "../auth/auth.guard";

import { formateId } from "src/utils/formateId";
import { emi_records_category } from "@prisma/client";
import { DatabaseService } from "src/database/database.service";

@UseGuards(AuthGuard)
@Controller("report")
export class ReportController {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly reportService: ReportService
  ) {}

  @Get()
  async getReport(
    @Req() req,
    @Query("skip") skip: string | undefined,
    @Query("limit") limit: string | undefined,
    @Query("filter_from") filter_from: string | undefined,
    @Query("filter_to") filter_to: string | undefined,
    @Query("filter_collected_by") filter_collected_by: string | undefined,
    @Query("filter_plan_type") filter_plan_type: string | undefined
  ) {
    const collector_id = filter_collected_by
      ? (filter_collected_by as string)?.match(/\d*\d/gm)
      : null;

    if (["Admin", "Manager"].includes(req.user.role ?? "")) {
      const data = await this.databaseService.emi_records.findMany({
        orderBy: {
          pay_date: "desc",
        },
        where: {
          collected_by: collector_id ? Number(collector_id[0]) : undefined,
          category: filter_plan_type as emi_records_category,
          pay_date: {
            gte: filter_from ? new Date(filter_from as string) : undefined,
            lt: filter_to ? new Date(filter_to as string) : undefined,
          },
        },
        include: {
          collector: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        take: parseInt(limit as string),
        skip: parseInt(skip as string),
      });

      const pending = await this.databaseService.emi_records.aggregate({
        where: {
          collected_by: collector_id ? Number(collector_id[0]) : undefined,
          category: filter_plan_type as emi_records_category,
          status: {
            notIn: ["Paid", "Hold"],
          },
          pay_date: {
            gte: filter_from ? new Date(filter_from as string) : undefined,
            lt: filter_to ? new Date(filter_to as string) : undefined,
          },
        },
        _sum: {
          amount: true,
          late_fee: true,
        },
      });

      const loan = await this.databaseService.emi_records.aggregate({
        where: {
          category: "Loan",
          collected_by: collector_id ? Number(collector_id[0]) : undefined,
          pay_date: {
            gte: filter_from
              ? new Date(filter_from as string)
              : new Date(new Date().setHours(0, 0, 0)),
            lt: filter_to ? new Date(filter_to as string) : undefined,
          },
        },
        _sum: {
          amount: true,
        },
      });

      const deposit = await this.databaseService.emi_records.aggregate({
        where: {
          category: "Deposit",
          collected_by: collector_id ? Number(collector_id[0]) : undefined,
          pay_date: {
            gte: filter_from
              ? new Date(filter_from as string)
              : new Date(new Date().setHours(0, 0, 0)),
            lt: filter_to ? new Date(filter_to as string) : undefined,
          },
        },
        _sum: {
          amount: true,
        },
      });

      const total = await this.databaseService.emi_records.count({
        where: {
          collected_by: collector_id ? Number(collector_id[0]) : undefined,
          category: filter_plan_type as emi_records_category,
          pay_date: {
            gte: filter_from ? new Date(filter_from as string) : undefined,
            lt: filter_to ? new Date(filter_to as string) : undefined,
          },
        },
      });

      return {
        status: true,
        data: {
          reports: data,
          total,
          pending: Number(pending._sum.amount) + Number(pending._sum.late_fee),
          loan: Number(loan._sum.amount),
          deposit: Number(deposit._sum.amount),
          late_fee: Number(pending._sum.late_fee),
        },
      };
    }

    if (req.user.role !== "Agent") {
      throw new BadRequestException("Unauthorized");
    }

    const data = await this.databaseService.emi_records.findMany({
      where: {
        collected_by: req.user.id,
        category: filter_plan_type as emi_records_category,
        pay_date: {
          gte: filter_from ? new Date(filter_from as string) : undefined,
          lt: filter_to ? new Date(filter_to as string) : undefined,
        },
      },
      orderBy: {
        pay_date: "desc",
      },
      include: {
        collector: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      take: parseInt(limit as string),
      skip: parseInt(skip as string),
    });

    const pending = await this.databaseService.emi_records.aggregate({
      where: {
        collected_by: req.user.id,
        category: filter_plan_type as emi_records_category,
        status: {
          notIn: ["Paid", "Hold"],
        },
        pay_date: {
          gte: filter_from ? new Date(filter_from as string) : undefined,
          lt: filter_to ? new Date(filter_to as string) : undefined,
        },
      },
      _sum: {
        amount: true,
        late_fee: true,
      },
    });

    const loan = await this.databaseService.emi_records.aggregate({
      where: {
        category: "Loan",
        collected_by: req.user.id,
        pay_date: {
          gte: filter_from
            ? new Date(filter_from as string)
            : new Date(new Date().setHours(0, 0, 0)),
          lt: filter_to ? new Date(filter_to as string) : undefined,
        },
      },
      _sum: {
        amount: true,
      },
    });

    const deposit = await this.databaseService.emi_records.aggregate({
      where: {
        category: "Deposit",
        collected_by: req.user.id,
        pay_date: {
          gte: filter_from
            ? new Date(filter_from as string)
            : new Date(new Date().setHours(0, 0, 0)),
          lt: filter_to ? new Date(filter_to as string) : undefined,
        },
      },
      _sum: {
        amount: true,
      },
    });

    const total = await this.databaseService.emi_records.count({
      where: {
        collected_by: req.user.id,
        category: filter_plan_type as emi_records_category,
        pay_date: {
          gte: filter_from ? new Date(filter_from as string) : undefined,
          lt: filter_to ? new Date(filter_to as string) : undefined,
        },
      },
    });

    console.log(total);

    return {
      status: true,
      data: {
        reports: data,
        total,
        pending: Number(pending._sum.amount) + Number(pending._sum.late_fee),
        loan: Number(loan._sum.amount),
        deposit: Number(deposit._sum.amount),
        late_fee: Number(pending._sum.late_fee),
      },
    };
  }

  @Get("pendings")
  async getPendings(
    @Req() req,
    @Query("limit") limit: string | undefined,
    @Query("skip") skip: string | undefined
  ) {
    if (!["Admin", "Manager"].includes(req.user.role ?? "")) {
      throw new BadRequestException("Unauthorized");
    }

    const data = await this.databaseService.emi_records.groupBy({
      by: ["collected_by"],
      orderBy: {
        collected_by: "desc",
      },
      where: {
        status: {
          notIn: ["Paid", "Hold"],
        },
      },
      _sum: {
        amount: true,
        late_fee: true,
      },
      take: parseInt(limit ?? "10"),
      skip: parseInt(skip ?? "0"),
    });

    const txns = await this.getUsers(data);

    const pending = await this.databaseService.emi_records.aggregate({
      where: {
        status: {
          notIn: ["Paid", "Hold"],
        },
      },
      _sum: {
        amount: true,
        late_fee: true,
      },
    });

    return {
      status: true,
      data: {
        txns: txns,
        pending: Number(pending._sum.amount) + Number(pending._sum.late_fee),
      },
    };
  }

  @Post("mark-paid")
  async markAsPaid(@Req() req, @Body() body) {
    if (!["Admin", "Manager"].includes(req.user.role ?? "")) {
      throw new BadRequestException("Unauthorized");
    }

    const total_collection_amount =
      await this.databaseService.emi_records.aggregate({
        where: {
          collected_by: body.id,
          status: "Collected",
        },
        _sum: {
          amount: true,
          late_fee: true,
        },
      });

    const updated_wallet = await this.databaseService.wallets.update({
      where: {
        user_id: req.user.id,
      },
      data: {
        balance: {
          increment:
            Number(total_collection_amount._sum.amount) +
            Number(total_collection_amount._sum.late_fee),
        },
      },
    });

    // create a txn for that
    const txn = await this.databaseService.transactions.create({
      data: {
        wallet_id: updated_wallet.id,
        amount: total_collection_amount._sum.amount,
        fee: total_collection_amount._sum.late_fee,
        balance: Number(updated_wallet.balance),
        txn_type: "Credit",
        txn_status: "Completed",
        txn_note: `Collection from agent (${formateId(
          Number(body.id),
          "User"
        )})`,
      },
    });

    // update the emi status to paid
    await this.databaseService.emi_records.updateMany({
      where: {
        collected_by: parseInt(body.id as string),
        status: "Collected",
      },
      data: {
        status: "Hold",
        hold_by: req.user.id,
      },
    });

    return {
      status: 200,
      message: "Marked As Paid!",
    };
  }

  private async getUsers(txns: any) {
    const txnsWithUser = [];

    for (let i = 0; i < txns.length; i++) {
      const user = await this.databaseService.user.findFirst({
        where: {
          id: txns[i].collected_by,
        },
        select: {
          id: true,
          name: true,
          role: true,
        },
      });

      txnsWithUser.push({ ...txns[i], user: user });
    }

    return txnsWithUser;
  }
}
