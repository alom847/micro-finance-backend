import { Module } from "@nestjs/common";
import { CronJobService } from "./cron.service";
import { CronController } from "./cron.controller";
import { ScheduleModule } from "@nestjs/schedule";

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [CronController],
  providers: [CronJobService],
})
export class CronModule {}
