import {
  Controller,
  Get,
  Body,
  Post,
  Req,
  Param,
  ParseIntPipe,
  UseGuards,
} from "@nestjs/common";

import { RepaymentService } from "./repayment.service";
import { AuthGuard } from "../auth/auth.guard";

import { DatabaseService } from "src/database/database.service";
import { RequiredPermissions } from "src/auth/permission.decorator";
import { PermissionGuard } from "src/auth/permission.guard";

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

  @UseGuards(PermissionGuard)
  @Post(":id/correct")
  @RequiredPermissions("repayment_correction")
  async correctRepaymentById(
    @Req() req,
    @Param("id", ParseIntPipe) id,
    @Body() body
  ) {
    return this.repaymentService.correctRepaymentById(req, id, body.emi_data);
  }
}
