import {
  Controller,
  Get,
  Req,
  Body,
  Patch,
  Post,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  Request,
  UseGuards,
  UnauthorizedException,
  BadRequestException,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuthGuard } from "../auth/auth.guard";
import { DatabaseService } from "../database/database.service";
import {
  FileFieldsInterceptor,
  FileInterceptor,
} from "@nestjs/platform-express";
import { StorageService } from "src/storage/storage.service";

import { LoansService } from "./loans.service";
import { UsersService } from "src/users/users.service";

@UseGuards(AuthGuard)
@Controller("loans")
export class LoansController {
  constructor(
    private readonly loansService: LoansService,
    private readonly storageService: StorageService,
    private readonly userService: UsersService
  ) {}

  @Get()
  findLoans(
    @Req() req,
    @Query("limit") limit: string | undefined,
    @Query("skip") skip: string | undefined,
    @Query("scope") scope: string | undefined,
    @Query("status") status: string | undefined
  ) {
    if (scope === "all") {
      if (!["Admin", "Manager"].includes(req.user.role ?? "")) {
        if (req.user.role === "Agent") {
          return this.userService.findAssignments(
            req.user.id,
            "Loan",
            parseInt(limit ?? "10"),
            parseInt(skip ?? "0")
          );
        }

        throw new BadRequestException("Unauthorized");
      }

      return this.loansService.fetchAll(
        parseInt(skip ?? "0"),
        parseInt(limit ?? "10"),
        status
      );
    }

    return this.loansService.findLoansByUserId(
      req.user.id,
      parseInt(limit ?? "10"),
      parseInt(skip ?? "0"),
      status
    );
  }

  @Post("apply")
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: "guarantor_photo", maxCount: 1 },
      { name: "standard_form", maxCount: 1 },
    ])
  )
  async applyForLoan(
    @Req() req,
    @UploadedFiles()
    files: {
      guarantor_photo?: Express.Multer.File[];
      standard_form?: Express.Multer.File[];
    },
    @Body() body
  ) {
    if (!req.user.ac_status) {
      throw new BadRequestException("your account is not active.");
    }

    if (!req.user.kyc_verified) {
      throw new BadRequestException("Please get your KYC verified.");
    }

    try {
      const standard_form_url = await this.storageService.upload(
        files.standard_form[0].originalname,
        files.standard_form[0].buffer
      );

      const guarantor_photo_url = await this.storageService.upload(
        files.guarantor_photo[0].originalname,
        files.guarantor_photo[0].buffer
      );

      return this.loansService.applyForLoan(req.user.id, {
        ...body,
        standard_form_url,
        guarantor_photo_url,
      });
    } catch (error) {
      return { error: "Failed to upload file", details: error.message };
    }
  }

  @Get(":id")
  async findLoan(@Req() req, @Param("id", ParseIntPipe) id) {
    return this.loansService.findUserLoanById(req.user.id, id);
  }

  @Get(":id/due")
  async getLoanDue(@Req() req, @Param("id", ParseIntPipe) id) {
    return this.loansService.findUserLoanDueById(id);
  }

  @Post(":id/reapply")
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: "guarantor_photo", maxCount: 1 },
      { name: "standard_form", maxCount: 1 },
    ])
  )
  async reapplyForLoan(
    @Req() req,
    @UploadedFiles()
    files: {
      guarantor_photo?: Express.Multer.File[];
      standard_form?: Express.Multer.File[];
    },
    @Param("id", ParseIntPipe) id,
    @Body() body
  ) {
    if (!["Admin", "Manager"].includes(req.user.role ?? "")) {
      if (!req.user.ac_status) {
        throw new BadRequestException("your account is not active.");
      }

      if (!req.user.kyc_verified) {
        throw new BadRequestException("Please get your KYC verified.");
      }
    }

    try {
      let standard_form_url;
      let guarantor_photo_url;

      if (files.standard_form) {
        standard_form_url = await this.storageService.upload(
          files.standard_form[0].originalname,
          files.standard_form[0].buffer
        );
      }

      if (files.guarantor_photo) {
        guarantor_photo_url = await this.storageService.upload(
          files.guarantor_photo[0].originalname,
          files.guarantor_photo[0].buffer
        );
      }

      return this.loansService.reapplyLoanByLoanId(req.user.id, id, {
        ...body,
        standard_form_url,
        guarantor_photo_url,
      });
    } catch (error) {
      console.log(error);
      return { error: "Failed to upload file", details: error.message };
    }
  }

  @Post(":id/update")
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: "guarantor_photo", maxCount: 1 },
      { name: "standard_form", maxCount: 1 },
    ])
  )
  async updateLoanByLoanId(
    @Req() req,
    @UploadedFiles()
    files: {
      guarantor_photo?: Express.Multer.File[];
      standard_form?: Express.Multer.File[];
    },
    @Param("id", ParseIntPipe) id,
    @Body() body
  ) {
    if (!["Admin", "Manager"].includes(req.user.role ?? "")) {
      // if (!req.user.ac_status) {
      //   throw new BadRequestException("your account is not active.");
      // }

      // if (!req.user.kyc_verified) {
      //   throw new BadRequestException("Please get your KYC verified.");
      // }

      throw new BadRequestException("Unauthorized");
    }

    console.log(body);

    try {
      let standard_form_url;
      let guarantor_photo_url;

      if (files.standard_form) {
        standard_form_url = await this.storageService.upload(
          files.standard_form[0].originalname,
          files.standard_form[0].buffer
        );
      }

      if (files.guarantor_photo) {
        guarantor_photo_url = await this.storageService.upload(
          files.guarantor_photo[0].originalname,
          files.guarantor_photo[0].buffer
        );
      }

      return this.loansService.UpdateLoanByLoanId(id, {
        ...body,
        standard_form_url,
        guarantor_photo_url,
      });
    } catch (error) {
      console.log(error);
      return { error: "Failed to upload file", details: error.message };
    }
  }

  @Get(":id/repayments")
  async findUserLoanRepaymentsById(
    @Req() req,
    @Param("id", ParseIntPipe) id,
    @Query("limit", ParseIntPipe) limit: string | undefined,
    @Query("skip", ParseIntPipe) skip: string | undefined
  ) {
    return this.loansService.findUserLoanRepaymentsById(
      req.user.id,
      id,
      parseInt(limit ?? "10"),
      parseInt(skip ?? "0")
    );
  }

  @Get(":id/agents")
  async findAssignedAgents(
    @Req() req,
    @Param("id", ParseIntPipe) id,
    @Query("agent_id") agent_id: string | undefined
  ) {
    return this.loansService.findAssignedAgentsByLoanId(id, agent_id);
  }

  @Post(":id/approve")
  async approveLoan(@Req() req, @Param("id", ParseIntPipe) id) {
    return this.loansService.ApproveLoanById(req.user.id, id);
  }

  @Post(":id/reject")
  async rejectLoan(@Req() req, @Param("id", ParseIntPipe) id, @Body() body) {
    return this.loansService.RejectLoanById(req.user.id, id, body.remark);
  }

  @Post(":id/assign-agent")
  async assignAgent(@Req() req, @Param("id", ParseIntPipe) id, @Body() body) {
    return this.loansService.assignAgent(id, body.agent_id);
  }

  @Post(":id/unassign-agent")
  async unassignAgent(@Req() req, @Param("id", ParseIntPipe) id, @Body() body) {
    return this.loansService.unassignAgent(id, body.agent_id);
  }

  @Post(":id/collect")
  async collectRepayment(
    @Req() req,
    @Param("id", ParseIntPipe) id,
    @Body() body
  ) {
    return this.loansService.collectRepayment(req, id, body.emi_data);
  }

  @Post(":id/settle")
  async settlement(@Req() req, @Param("id", ParseIntPipe) id, @Body() body) {
    return this.loansService.settlement(req.user.id, id, body.settle_data);
  }

  @Post(":id/update-referrer")
  async updateReferrer(
    @Req() req,
    @Param("id", ParseIntPipe) id,
    @Body() body
  ) {
    console.log(body);

    if (!["Admin", "Manager"].includes(req.user.role ?? "")) {
      throw new BadRequestException("Unauthorized");
    }

    return this.loansService.updateReferrer(id, body.ref_id);
  }
}
