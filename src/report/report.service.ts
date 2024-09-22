import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { kyc_verifications, Prisma } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { DatabaseService } from "../database/database.service";

@Injectable()
export class ReportService {
  constructor(private readonly databaseService: DatabaseService) {}
}
