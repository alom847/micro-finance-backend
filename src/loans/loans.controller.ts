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
import { compareHash } from "src/utils/hash";
import { PermissionGuard } from "src/auth/permission.guard";
import { RequiredPermissions } from "src/auth/permission.decorator";
import { NotesService } from "src/notes/note.service";
import { CreateNoteDto } from "src/notes/dto/note.dto";

@UseGuards(AuthGuard)
@Controller("loans")
export class LoansController {
  constructor(
    private readonly storageService: StorageService,
    private readonly databaseService: DatabaseService,
    private readonly loansService: LoansService,
    private readonly userService: UsersService,
    private readonly notesService: NotesService
  ) {}

  @Get()
  findLoans(
    @Req() req,
    @Query("limit") limit: string | undefined,
    @Query("skip") skip: string | undefined,
    @Query("scope") scope: string | undefined,
    @Query("status") status: string | undefined,
    @Query("search") search: string | undefined
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
        status,
        search
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
      if (!files.guarantor_photo) {
        throw new BadRequestException("Guarantor photo is required!");
      }

      if (!files.standard_form) {
        throw new BadRequestException("Standard form is required!");
      }

      const standard_form_url = await this.storageService.upload(
        files.standard_form[0].originalname,
        files.standard_form[0].buffer,
        false
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
      return { success: false, message: error.message };
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
          files.standard_form[0].buffer,
          false
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

  @UseGuards(PermissionGuard)
  @RequiredPermissions("loan_approval")
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
          files.standard_form[0].buffer,
          false
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

  @UseGuards(PermissionGuard)
  @RequiredPermissions("loan_approval")
  @Post(":id/approve")
  async approveLoan(@Req() req, @Param("id", ParseIntPipe) id) {
    return this.loansService.ApproveLoanById(req.user.id, id);
  }

  @UseGuards(PermissionGuard)
  @RequiredPermissions("loan_approval")
  @Post(":id/reject")
  async rejectLoan(@Req() req, @Param("id", ParseIntPipe) id, @Body() body) {
    return this.loansService.RejectLoanById(req.user.id, id, body.remark);
  }

  @UseGuards(PermissionGuard)
  @RequiredPermissions("agent_assignment")
  @Post(":id/assign-agent")
  async assignAgent(@Req() req, @Param("id", ParseIntPipe) id, @Body() body) {
    return this.loansService.assignAgent(id, body.agent_id);
  }

  @UseGuards(PermissionGuard)
  @RequiredPermissions("agent_assignment")
  @Post(":id/unassign-agent")
  async unassignAgent(@Req() req, @Param("id", ParseIntPipe) id, @Body() body) {
    return this.loansService.unassignAgent(id, body.agent_id);
  }

  @UseGuards(PermissionGuard)
  @RequiredPermissions("repayment_collection")
  @Post(":id/collect")
  async collectRepayment(
    @Req() req,
    @Param("id", ParseIntPipe) id,
    @Body() body
  ) {
    return this.loansService.collectRepayment(req, id, body.emi_data);
  }

  @UseGuards(PermissionGuard)
  @RequiredPermissions("loan_settlement")
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

  @Post(":id/reopen")
  async reopenLoan(@Req() req, @Param("id", ParseIntPipe) id, @Body() body) {
    if (!["Admin"].includes(req.user.role ?? "")) {
      throw new BadRequestException("Unauthorized");
    }

    const user = await this.databaseService.user.findFirst({
      where: {
        id: req.user.id,
      },
    });

    if (!user || !compareHash(body.pwd, user.password)) {
      throw new BadRequestException("Unauthorized");
    }

    return this.loansService.reopen(id);
  }

  @UseGuards(PermissionGuard)
  @Post(":id/add-note")
  async addNoteToLoan(
    @Req() req,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: CreateNoteDto
  ) {
    const note = await this.notesService.addNote(req.user.id, {
      content: body.content,
      loan_id: id,
    });
    return { status: true, note };
  }

  @Get(":id/notes")
  async getUserNotes(@Param("id", ParseIntPipe) id: number) {
    const notes = await this.notesService.getNotes({ loan_id: id });
    return { status: true, notes };
  }

  @UseGuards(PermissionGuard)
  @RequiredPermissions("agent_assignment")
  @Delete("note/:noteId")
  async deleteUserNote(@Param("noteId", ParseIntPipe) noteId: number) {
    await this.notesService.deleteNote(noteId);
    return { status: true, message: "Note deleted" };
  }
}
