import { Module } from "@nestjs/common";
import { CronJobService } from "./cron.service";
import { CronController } from "./cron.controller";

@Module({
  controllers: [CronController],
  providers: [CronJobService],
})
export class CronModule {}
