import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { due_record_status, kyc_verifications, Prisma } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { DatabaseService } from "../database/database.service";
import { formateId } from "src/utils/formateId";

@Injectable()
export class EmployeeService {
  constructor(private readonly databaseService: DatabaseService) {}
}
