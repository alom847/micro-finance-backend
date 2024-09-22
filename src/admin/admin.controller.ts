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
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { AuthGuard } from '../auth/auth.guard';

import { formateId } from 'src/utils/formateId';

@UseGuards(AuthGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}
}
