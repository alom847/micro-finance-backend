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
}
