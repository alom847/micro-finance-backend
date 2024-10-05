import {
  Controller,
  Get,
  Param,
  UseGuards,
  Request,
  ParseIntPipe,
  Query,
  Post,
  Body,
  Put,
} from "@nestjs/common";
import { CronJobService } from "./cron.service";
import { AuthGuard } from "../auth/auth.guard";

@Controller("cron")
export class CronController {
  constructor(private readonly cronService: CronJobService) {}

  @Get()
  commission(@Request() req, @Body() body) {
    return this.cronService.sendCommissions();
  }
}
