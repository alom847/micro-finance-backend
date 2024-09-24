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

import { RepaymentService } from "./repayment.service";
import { AuthGuard } from "../auth/auth.guard";

import { formateId } from "src/utils/formateId";
import { emi_records_category } from "@prisma/client";
import { DatabaseService } from "src/database/database.service";

@UseGuards(AuthGuard)
@Controller("repayments")
export class RepaymentController {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly repaymentService: RepaymentService
  ) {}

  @Get(":id")
  async getRepaymentById(@Req() req, @Param("id", ParseIntPipe) id) {
    return this.repaymentService.getRepaymentId(id);
  }

  @Post(":id/correct")
  async correctRepaymentById(
    @Req() req,
    @Param("id", ParseIntPipe) id,
    @Body() body
  ) {
    return this.repaymentService.correctRepaymentById(req, id, body.emi_data);
  }
}
