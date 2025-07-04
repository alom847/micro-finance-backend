import {
  Controller,
  Get,
  Req,
  Body,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  Query,
  ParseIntPipe,
  Param,
  BadRequestException,
} from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import {
  FileFieldsInterceptor,
  FileInterceptor,
  FilesInterceptor,
} from "@nestjs/platform-express";
import { StorageService } from "src/storage/storage.service";

import { KycsService } from "./kycs.service";
import { skip } from "node:test";
import { PermissionGuard } from "src/auth/permission.guard";
import { RequiredPermissions } from "src/auth/permission.decorator";

@UseGuards(AuthGuard)
@Controller("kycs")
export class KycsController {
  constructor(
    private readonly kycService: KycsService,
    private readonly storageService: StorageService
  ) {}

  @Get()
  getKyc(
    @Req() req,
    @Query("limit") limit: string | undefined,
    @Query("skip") skip: string | undefined,
    @Query("scope") scope: string | undefined,
    @Query("status") status: string | undefined
  ) {
    if (scope === "all" && ["Admin", "Manager"].includes(req.user.role ?? "")) {
      return this.kycService.fetchKycs(
        parseInt(limit ?? "10"),
        parseInt(skip ?? "0"),
        status
      );
    }

    return this.kycService.findKycByUserId(req.user.id);
  }

  @UseGuards(PermissionGuard)
  @RequiredPermissions("kyc_management")
  @Get(":id")
  async fetchKycById(@Req() req, @Param("id", ParseIntPipe) id) {
    if (!["Admin", "Manager"].includes(req.user.role ?? "")) {
      throw new BadRequestException("Unauthorized");
    }

    return this.kycService.fetchKycById(id);
  }

  @UseGuards(PermissionGuard)
  @RequiredPermissions("kyc_management")
  @Post(":id/approve")
  async approveKycById(@Req() req, @Param("id", ParseIntPipe) id) {
    if (!["Admin", "Manager"].includes(req.user.role ?? "")) {
      throw new BadRequestException("Unauthorized");
    }

    return this.kycService.approveKycById(id);
  }

  @UseGuards(PermissionGuard)
  @RequiredPermissions("kyc_management")
  @Post(":id/reject")
  async rejectKycById(@Req() req, @Param("id", ParseIntPipe) id) {
    if (!["Admin", "Manager"].includes(req.user.role ?? "")) {
      throw new BadRequestException("Unauthorized");
    }

    return this.kycService.rejectKycById(id);
  }

  @Post("/reset")
  resetKyc(@Req() req) {
    return this.kycService.restKycByUserId(req.user.id);
  }

  @Post("/update-addr-proof")
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: "address_proof_front", maxCount: 1 },
      { name: "address_proof_back", maxCount: 1 },
    ])
  )
  async updateAddressProof(
    @Req() req,
    @UploadedFiles()
    files: {
      address_proof_front?: Express.Multer.File[];
      address_proof_back?: Express.Multer.File[];
    },
    @Body() body: { address_proof_type: string; address_proof_value: string }
  ) {
    try {
      const address_proof_front_url = await this.storageService.upload(
        files.address_proof_front[0].originalname,
        files.address_proof_front[0].buffer
      );

      const address_proof_back_url = await this.storageService.upload(
        files.address_proof_back[0].originalname,
        files.address_proof_back[0].buffer
      );

      return this.kycService.updateAddressProof(
        req.user.id,
        address_proof_front_url,
        address_proof_back_url,
        body.address_proof_type,
        body.address_proof_value
      );
    } catch (error) {
      return { error: "Failed to upload file", details: error.message };
    }
  }

  @Post("/update-id-proof")
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: "id_proof_front", maxCount: 1 },
      { name: "id_proof_back", maxCount: 1 },
    ])
  )
  async updateIdProof(
    @Req() req,
    @UploadedFiles()
    files: {
      id_proof_front?: Express.Multer.File[];
      id_proof_back?: Express.Multer.File[];
    },
    @Body() body: { id_proof_type: string; id_proof_value: string }
  ) {
    try {
      const id_proof_front_url = await this.storageService.upload(
        files.id_proof_front[0].originalname,
        files.id_proof_front[0].buffer
      );

      const id_proof_back_url = await this.storageService.upload(
        files.id_proof_back[0].originalname,
        files.id_proof_back[0].buffer
      );

      return this.kycService.updateIdProof(
        req.user.id,
        id_proof_front_url,
        id_proof_back_url,
        body.id_proof_type,
        body.id_proof_value
      );
    } catch (error) {
      return { error: "Failed to upload file", details: error.message };
    }
  }

  @Post("/update-selfie")
  @UseInterceptors(FileInterceptor("selfie"))
  async uploadSelfie(@Req() req, @UploadedFile() selfie: Express.Multer.File) {
    if (!selfie) {
      throw new BadRequestException("No selfie file uploaded.");
    }

    try {
      const selfie_url = await this.storageService.upload(
        selfie.originalname,
        selfie.buffer
      );

      return await this.kycService.updateSelfie(req.user.id, selfie_url);
    } catch (error) {
      console.error("Error uploading selfie:", error);
      throw new BadRequestException({
        message: "Failed to upload selfie.",
        error: error.message,
      });
    }
  }
}
