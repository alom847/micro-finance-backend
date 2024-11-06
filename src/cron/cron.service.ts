import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { DatabaseService } from "../database/database.service";

@Injectable()
export class CronJobService {
  constructor(private readonly databaseService: DatabaseService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async GenerateOverdues() {
    console.log("Start: Generating Overdues...");

    try {
      const count = await this.databaseService.due_record.updateMany({
        where: {
          status: "Due",
          due_date: {
            lt: new Date(new Date().setHours(0, 0, 0)),
          },
        },
        data: {
          status: "Overdue",
        },
      });

      console.log(`Updated ${count} due records`);
    } catch (e) {
      console.log(e);

      console.log("Failed: Generating Overdues...");
    } finally {
      console.log("Done: Generating Overdues...");
    }
  }
}
