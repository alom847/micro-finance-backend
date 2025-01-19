import { Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { kyc_status, kyc_verifications } from "@prisma/client";

@Injectable()
export class KycsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async fetchKycs(limit: number, skip: number, status: string = "Verified") {
    const kycs = await this.databaseService.kyc_verifications.findMany({
      orderBy: {
        created_at: "desc",
      },
      take: limit,
      skip: skip,
      where: {
        status: status as kyc_status,
      },
      include: {
        user: {
          select: {
            name: true,
            phone: true,
            created_at: true,
          },
        },
      },
    });

    const total = await this.databaseService.kyc_verifications.count({
      where: {
        status: status as kyc_status,
      },
    });

    return {
      status: true,
      message: { kycs: kycs, total: total },
    };
  }

  async findKycByUserId(userid: number) {
    const kyc = await this.databaseService.kyc_verifications.findFirst({
      where: {
        user_id: userid,
      },
    });

    if (!kyc) throw new NotFoundException("kyc not found");

    return { status: true, data: kyc };
  }

  async restKycByUserId(userid: number) {
    const updated_kyc = await this.databaseService.kyc_verifications.update({
      where: {
        user_id: userid,
      },
      data: {
        id_proof_type: null,
        id_proof_front: null,
        id_proof_back: null,
        address_proof_type: null,
        address_proof_front: null,
        address_proof_back: null,
        selfie: null,
        status: "NotFilled",
      },
    });

    return { status: true, data: updated_kyc };
  }

  async fetchKycById(kid: number) {
    const kyc = await this.databaseService.kyc_verifications.findFirst({
      where: {
        id: kid,
      },
    });

    return {
      status: true,
      message: kyc as kyc_verifications,
    };
  }

  async approveKycById(kid: number) {
    const kyc = await this.databaseService.kyc_verifications.update({
      where: {
        id: kid,
      },
      data: {
        status: "Verified",
        user: {
          update: {
            kyc_verified: true,
          },
        },
      },
    });

    return {
      status: true,
      message: kyc,
    };
  }

  async rejectKycById(kid: number) {
    const kyc = await this.databaseService.kyc_verifications.update({
      where: {
        id: kid,
      },
      data: {
        status: "Rejected",
        user: {
          update: {
            kyc_verified: true,
          },
        },
      },
    });

    await this.databaseService.user.update({
      where: {
        id: kyc.user_id,
      },
      data: {
        kyc_verified: false,
      },
    });

    return {
      status: true,
      message: kyc,
    };
  }

  async updateAddressProof(
    userid: number,
    address_proof_front_url: string,
    address_proof_back_url: string,
    address_proof_type: string,
    address_proof_value: string
  ) {
    const kyc = await this.databaseService.kyc_verifications.upsert({
      where: { user_id: userid },
      update: {
        address_proof_front: address_proof_front_url,
        address_proof_back: address_proof_back_url,
        address_proof_type: address_proof_type as string,
        address_proof_value: address_proof_value as string,
      },
      create: {
        user_id: userid,
        address_proof_front: address_proof_front_url,
        address_proof_back: address_proof_back_url,
        address_proof_type: address_proof_type as string,
        address_proof_value: address_proof_value as string,
      },
    });

    return { status: true, data: kyc };
  }

  async updateIdProof(
    userid: number,
    id_proof_front_url: string,
    id_proof_back_url: string,
    id_proof_type: string,
    id_proof_value: string
  ) {
    const kyc = await this.databaseService.kyc_verifications.upsert({
      where: { user_id: userid },
      update: {
        id_proof_front: id_proof_front_url,
        id_proof_back: id_proof_back_url,
        id_proof_type: id_proof_type as string,
        id_proof_value: id_proof_value as string,
      },
      create: {
        user_id: userid,
        id_proof_front: id_proof_front_url,
        id_proof_back: id_proof_back_url,
        id_proof_type: id_proof_type as string,
        id_proof_value: id_proof_value as string,
      },
    });

    return { status: true, data: kyc };
  }

  async updateSelfie(userid: number, selfie_url: string) {
    const kyc = await this.databaseService.kyc_verifications.upsert({
      where: { user_id: userid },
      update: {
        selfie: selfie_url,
        status: "Pending",
      },
      create: {
        user_id: userid,
        selfie: selfie_url,
        status: "Pending",
      },
    });

    return { status: true, data: kyc };
  }
}
