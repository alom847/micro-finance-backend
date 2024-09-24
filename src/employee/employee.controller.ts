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

import { EmployeeService } from "./employee.service";
import { AuthGuard } from "../auth/auth.guard";

import { formateId } from "src/utils/formateId";
import { emi_records_category } from "@prisma/client";
import { DatabaseService } from "src/database/database.service";
import { skip } from "node:test";

@UseGuards(AuthGuard)
@Controller("employees")
export class EmployeeController {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly employeeService: EmployeeService
  ) {}

  @Get()
  async fetchAll(@Req() req, @Query("limit") limit, @Query("skip") skip) {
    const total = await this.databaseService.user.count({
      where: {
        id: {
          not: req.user.id,
        },
        role: {
          in: ["Agent", "Manager"],
        },
      },
    });

    const employees = await this.databaseService.user.findMany({
      orderBy: {
        created_at: "desc",
      },
      where: {
        id: {
          not: req.user.id,
        },
        role: {
          in: ["Agent", "Manager"],
        },
      },
      take: parseInt(limit ?? "10"),
      skip: parseInt(skip ?? "0"),
    });

    return {
      status: true,
      data: {
        employees,
        total,
      },
    };
  }

  @Patch(":id")
  async update(@Req() req, @Param("id", ParseIntPipe) id) {
    const { data } = req.body;

    const updated_user = await this.databaseService.user.update({
      where: {
        id: id,
      },
      data: {
        role: data.role,
        permissions: data.permissions,
      },
    });

    return {
      status: true,
      message: updated_user,
    };
  }
}
