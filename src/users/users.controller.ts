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
  Request,
  UseGuards,
  UnauthorizedException,
  BadRequestException,
  UseInterceptors,
  UploadedFile,
  InternalServerErrorException,
} from "@nestjs/common";
import { UsersService } from "./users.service";
import { Prisma } from "@prisma/client";
import { AuthGuard } from "../auth/auth.guard";
import { DatabaseService } from "../database/database.service";
import { FileInterceptor } from "@nestjs/platform-express";
import { StorageService } from "src/storage/storage.service";

import * as CryptoJS from "crypto-js";

import { formateId } from "src/utils/formateId";
import {
  NotificationService,
  templates,
} from "src/notification/notification.service";
import { PermissionGuard } from "src/auth/permission.guard";
import { RequiredPermissions } from "src/auth/permission.decorator";
import { NotesService } from "src/notes/note.service";
import { CreateNoteDto } from "src/notes/dto/note.dto";

@UseGuards(AuthGuard)
@Controller("user")
export class UsersController {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly usersService: UsersService,
    private readonly storageService: StorageService,
    private readonly notificationService: NotificationService,
    private readonly notesService: NotesService
  ) {}

  hash(password: string): string {
    const hashedPassword = CryptoJS.AES.encrypt(
      password,
      process.env.SALT as string
    ).toString();

    return hashedPassword;
  }

  compareHash(plainTextPassword: string, hashedPassword: string): boolean {
    const decrypted_pass = CryptoJS.AES.decrypt(
      hashedPassword,
      process.env.SALT as string
    ).toString(CryptoJS.enc.Utf8);

    return plainTextPassword === decrypted_pass;
  }

  @UseGuards(PermissionGuard)
  @RequiredPermissions("user_management")
  @Get()
  async fetchAll(
    @Req() req,
    @Query("limit") limit: string | undefined,
    @Query("skip") skip: string | undefined,
    @Query("status") status: string | undefined
  ) {
    if (status === "Pending") {
      const tempAccounts = await this.databaseService.otp.findMany({
        where: {
          verified: true,
        },
      });

      const accounts = tempAccounts.map((account) => account.tmp_data);

      return {
        status: true,
        data: {
          users: accounts,
          total: accounts.length,
        },
      };
    }

    return this.usersService.findAll(
      req.user.id,
      parseInt(limit ?? "10"),
      parseInt(skip ?? "0")
    );
  }

  @Get("profile")
  async profile(@Req() req) {
    return this.usersService.findOneById(req.user.id);
  }

  @Post("profile/update")
  updateProfile(@Req() req, @Body() userUpdateInput: Prisma.userUpdateInput) {
    if (req.user.role !== "Admin" && req.user.ac_status) {
      throw new BadRequestException(
        "Can't make any changes, after account has been approved."
      );
    }

    return this.usersService.update(req.user.id, userUpdateInput);
  }

  @Post("profile/update-dp")
  @UseInterceptors(FileInterceptor("profile_img"))
  async updateProfilePic(
    @Req() req,
    @UploadedFile() profile_img: Express.Multer.File
  ) {
    if (req.user.role !== "Admin" && req.user.ac_status) {
      throw new BadRequestException(
        "Can't make any changes, after account has been approved."
      );
    }

    console.log(profile_img);

    try {
      const image_url = await this.storageService.upload(
        profile_img.originalname,
        profile_img.buffer
      );

      return this.usersService.updateProfilePic(req.user.id, image_url);
    } catch (error) {
      return { error: "Failed to upload file", details: error.message };
    }
  }

  @Post("settings/change-pass")
  async changePassword(@Req() req, @Body() body) {
    if (body.new_pass !== body.confirm) {
      throw new BadRequestException("Password did not matched!");
    }

    if (body.new_pass.length < 6) {
      throw new BadRequestException("Password must be atleast 6 char long!");
    }

    const user = await this.databaseService.user.findFirst({
      where: {
        id: req.user.id,
      },
    });

    const hashedPassword = this.hash(body.new_pass as string);

    if (!this.compareHash(body.old_pass, user.password)) {
      throw new BadRequestException("Old Password did not matched!");
    }

    await this.databaseService.user.update({
      where: {
        id: req.user.id,
      },
      data: {
        password: hashedPassword,
      },
    });

    return {
      status: true,
      message: "Password has been changed Successfully.",
    };
  }

  @Get("referrals")
  async referrals(@Req() req) {
    const deposits = await this.databaseService.deposits.aggregate({
      _sum: {
        total_paid: true,
      },
      _count: {
        amount: true,
      },
      where: {
        ref_id: req.user.id,
        deposit_status: "Active",
      },
    });

    const loans = await this.databaseService.loans.aggregate({
      _sum: {
        amount: true,
      },
      _count: {
        amount: true,
      },
      where: {
        ref_id: req.user.id,
        loan_status: "Active",
      },
    });

    const deposit_refs = await this.databaseService.deposits.findMany({
      where: {
        ref_id: req.user.id,
        deposit_status: "Active",
      },
      select: {
        id: true,
        total_paid: true,
        amount: true,
        category: true,
      },
    });

    const loan_refs = await this.databaseService.loans.findMany({
      where: {
        ref_id: req.user.id,
        loan_status: "Active",
      },
      select: {
        id: true,
        total_paid: true,
        total_payable: true,
      },
    });

    const referrals: {
      id: string;
      amount: number;
      category: "Loan" | "Deposit";
    }[] = [];

    loan_refs.map((loan) => {
      referrals.push({
        id: formateId(loan.id, "Loan"),
        amount: Number(loan.total_payable) - Number(loan.total_paid),
        category: "Loan",
      });
    });

    deposit_refs.map((deposit) => {
      referrals.push({
        id: formateId(deposit.id, deposit.category as "RD" | "FD"),
        amount: Number(deposit.total_paid),
        category: "Deposit",
      });
    });

    return {
      status: true,
      data: {
        deposits: {
          count: deposits._count.amount,
          amount: Number(deposits._sum.total_paid),
        },
        loans: {
          count: loans._count.amount,
          amount: Number(loans._sum.amount),
        },
        referrals,
      },
    };
  }

  @Get("dash-data")
  async dashData(@Req() req) {
    if (!["Admin", "Manager"].includes(req.user.role ?? "")) {
      const deposits = await this.databaseService.deposits.aggregate({
        _sum: {
          total_paid: true,
        },
        _count: {
          amount: true,
        },
        where: {
          user_id: req.user.id,
          deposit_status: "Active",
        },
      });

      const loans = await this.databaseService.loans.aggregate({
        _sum: {
          total_paid: true,
          total_payable: true,
        },
        _count: {
          amount: true,
        },
        where: {
          user_id: req.user.id,
          loan_status: "Active",
        },
      });

      // const deposit_due = await this.databaseService.due_record.findMany({
      //   orderBy: {
      //     "due_date": "asc"
      //   },
      //   where: {
      //     category: "Deposit",
      //     status: "Due"
      //   },
      //   take: 1,
      // });

      // const loan_due = await this.databaseService.due_record.findMany({
      //   orderBy: {
      //     due_date: "asc",
      //   },
      //   where: {

      //   },
      //   take: 1,
      // });

      let emi_due = null;

      return {
        status: true,
        message: {
          deposits: {
            count: deposits._count.amount,
            amount: deposits._sum.total_paid,
          },
          loans: {
            count: loans._count.amount,
            amount:
              Number(loans._sum.total_payable) - Number(loans._sum.total_paid),
          },
          emi: emi_due,
        },
      };
    }

    const deposits = await this.databaseService.deposits.aggregate({
      _sum: {
        total_paid: true,
      },
      _count: {
        amount: true,
      },
      where: {
        deposit_status: "Active",
      },
    });

    const deposit_paid_today = await this.databaseService.emi_records.aggregate(
      {
        where: {
          category: "Deposit",
          OR: [
            {
              status: "Paid",
            },
            {
              status: "Collected",
            },
            {
              status: "Hold",
            },
          ],
          created_at: {
            gte: new Date(new Date(new Date().setHours(0))),
            lte: new Date(new Date(new Date().setHours(24))),
          },
        },
        _sum: {
          amount: true,
        },
      }
    );

    const loans = await this.databaseService.loans.aggregate({
      _sum: {
        total_payable: true,
        total_paid: true,
      },
      _count: {
        amount: true,
      },
      where: {
        loan_status: "Active",
      },
    });

    const loan_paid_today = await this.databaseService.emi_records.aggregate({
      where: {
        category: "Loan",
        OR: [
          {
            status: "Paid",
          },
          {
            status: "Collected",
          },
          {
            status: "Hold",
          },
        ],
        created_at: {
          gte: new Date(new Date(new Date().setHours(0))),
          lte: new Date(new Date(new Date().setHours(24))),
        },
      },
      _sum: {
        amount: true,
      },
    });

    const loan_due_today = await this.databaseService.due_record.aggregate({
      where: {
        category: "Loan",
        status: "Due",
        due_date: {
          gte: new Date(new Date(new Date().setHours(0))),
          lte: new Date(new Date(new Date().setHours(24))),
        },
      },
      _sum: {
        emi_amount: true,
      },
    });

    const deposit_due_today = await this.databaseService.due_record.aggregate({
      where: {
        category: "Deposit",
        status: "Due",
        due_date: {
          gte: new Date(new Date(new Date().setHours(0))),
          lte: new Date(new Date(new Date().setHours(24))),
        },
      },
      _sum: {
        emi_amount: true,
      },
    });

    const today_incoming = await this.databaseService.emi_records.aggregate({
      where: {
        created_at: {
          gte: new Date(new Date(new Date().setHours(0))),
          lte: new Date(new Date(new Date().setHours(24))),
        },
      },
      _sum: {
        amount: true,
      },
    });

    const today_disburshed = await this.databaseService.transactions.aggregate({
      where: {
        created_at: {
          gte: new Date(new Date(new Date().setHours(0))),
          lte: new Date(new Date(new Date().setHours(24))),
        },
        txn_type: {
          in: [
            "Disburshed",
            "MatureClosed",
            "PrematureClosed",
            "ApprovedWithdrawal",
          ],
        },
      },
      _sum: {
        amount: true,
      },
    });

    const balance = await this.databaseService.wallets.aggregate({
      where: {
        owner: {
          role: {
            in: ["Admin", "Manager"],
          },
        },
      },
      _sum: {
        balance: true,
      },
    });

    const matured = await this.databaseService.deposits.aggregate({
      _sum: {
        total_paid: true,
      },
      _count: {
        amount: true,
      },
      where: {
        deposit_status: {
          in: ["Matured"],
        },
      },
    });

    return {
      status: true,
      message: {
        deposits: {
          count: deposits._count.amount,
          amount: deposits._sum.total_paid,
          today: {
            paid: Number(deposit_paid_today._sum.amount),
            due: Number(deposit_due_today._sum.emi_amount),
          },
        },
        matured: {
          count: matured._count.amount,
          amount: Number(matured._sum.total_paid),
        },
        loans: {
          count: loans._count.amount,
          amount:
            Number(loans._sum.total_payable) - Number(loans._sum.total_paid),
          today: {
            paid: Number(loan_paid_today._sum.amount),
            due: Number(loan_due_today._sum.emi_amount),
          },
        },
        collection: Number(today_incoming._sum.amount),
        today_disburshed: Number(today_disburshed._sum.amount),
        wallet_balance: Number(balance._sum.balance),
      },
    };
  }

  @Get("assignments")
  async findAssignments(
    @Req() req,
    @Query("type") type: string,
    @Query("skip") skip: string | undefined,
    @Query("limit") limit: string | undefined,
    @Query("search") search: string | undefined
  ) {
    if (req.user.role !== "Agent")
      throw new BadRequestException("Unauthorized");

    return this.usersService.findAssignments(
      req.user.id,
      type,
      parseInt(limit ?? "10"),
      parseInt(skip ?? "0"),
      search
    );
  }

  @UseGuards(PermissionGuard)
  @RequiredPermissions("view_user_details")
  @Get(":id")
  async getUser(@Req() req, @Param("id", ParseIntPipe) id) {
    return this.usersService.findUserDetails(id);
  }

  @UseGuards(PermissionGuard)
  @RequiredPermissions("user_management")
  @Post(":id/update")
  async updateUser(@Req() req, @Param("id", ParseIntPipe) id, @Body() body) {
    return this.usersService.updateUserByUserId(id, body);
  }

  @UseGuards(PermissionGuard)
  @RequiredPermissions("user_management")
  @Post(":id/change-pwd")
  async ChangeUserPwd(@Req() req, @Param("id", ParseIntPipe) id, @Body() body) {
    if (!(body.password && (body.password as string).length >= 6)) {
      throw new BadRequestException(
        "Password must be atleast 6 chracters long"
      );
    }

    const hash_password = CryptoJS.AES.encrypt(
      body.password,
      process.env.SALT as string
    ).toString();

    await this.databaseService.user.update({
      where: {
        id: id,
      },
      data: {
        password: hash_password,
      },
    });

    return {
      status: true,
      message: "success",
    };
  }

  @UseGuards(PermissionGuard)
  @RequiredPermissions("user_management")
  @Post("approve")
  async approve(@Req() req, @Body() body) {
    const signup_request = await this.databaseService.otp.findFirst({
      where: {
        verified: true,
        identifier: body.phone,
      },
    });

    const registration_data = signup_request.tmp_data as Prisma.JsonObject;

    const decrypted_password = CryptoJS.AES.decrypt(
      registration_data.password as string,
      process.env.SALT as string
    ).toString(CryptoJS.enc.Utf8);

    await this.databaseService.otp.deleteMany({
      where: {
        identifier: signup_request.identifier,
      },
    });

    const { data: user } = await this.usersService.create({
      phone: signup_request.identifier,
      email: registration_data?.email as string,
      password: registration_data?.password as string,
      name: registration_data?.name as string,
    });

    if (!user) {
      throw new InternalServerErrorException("Unable to create an account.");
    }

    this.notificationService.sendSMS(
      signup_request.identifier,
      templates.User_Create_Confirmation,
      [
        {
          Key: "customer",
          Value: registration_data?.name as string,
        },
        {
          Key: "password",
          Value: decrypted_password,
        },
        {
          Key: "username",
          Value: signup_request.identifier,
        },
      ]
    );

    return {
      status: true,
      message: "success",
    };
  }

  @UseGuards(PermissionGuard)
  @RequiredPermissions("user_management")
  @Post("reject")
  async reject(@Req() req, @Body() body) {
    await this.databaseService.otp.deleteMany({
      where: {
        identifier: body.phone,
      },
    });

    return {
      status: true,
      message: "success",
    };
  }

  @UseGuards(PermissionGuard)
  @RequiredPermissions("user_management")
  @Post(":id/add-note")
  async addNoteToUser(
    @Req() req,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: CreateNoteDto
  ) {
    const note = await this.notesService.addNote(req.user.id, {
      content: body.content,
      user_id: id,
    });
    return { status: true, note };
  }

  @Get(":id/notes")
  async getUserNotes(@Param("id", ParseIntPipe) id: number) {
    const notes = await this.notesService.getNotes({ user_id: id });
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
