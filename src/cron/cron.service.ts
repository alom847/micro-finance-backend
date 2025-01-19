import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { DatabaseService } from "../database/database.service";

@Injectable()
export class CronJobService {
  constructor(private readonly databaseService: DatabaseService) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM, {
    utcOffset: 330,
  })
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

  @Cron(CronExpression.EVERY_DAY_AT_1AM, {
    utcOffset: 330,
  })
  async MatureDeposits() {
    console.log("Start: Mature deposits...");

    try {
      const count = await this.databaseService.deposits.updateMany({
        where: {
          deposit_status: "Active",
          maturity_date: {
            lt: new Date(new Date().setHours(0, 0, 0)),
          },
        },
        data: {
          deposit_status: "Matured",
        },
      });

      console.log(`Matured ${count} deposits`);
    } catch (e) {
      console.log(e);

      console.log("Failed: Maturing deposits...");
    } finally {
      console.log("Done: Maturing deposits...");
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_1AM, {
    utcOffset: 330,
  })
  async DeleteRejectedApplications() {
    console.log("Start:deleteing rejected applications...");

    const today = new Date();
    today.setHours(0, 0, 0);

    try {
      const depositCount = await this.databaseService.deposits.deleteMany({
        where: {
          deposit_status: "Rejected",
          created_at: {
            lt: new Date(new Date().setDate(today.getDate() - 30)),
          },
        },
      });

      console.log(` ${depositCount} rejected deposits deleted`);

      const loanCount = await this.databaseService.loans.deleteMany({
        where: {
          loan_status: "Rejected",
          created_at: {
            lt: new Date(new Date().setDate(today.getDate() - 30)),
          },
        },
      });

      console.log(`${loanCount} rejected loans deleted`);
    } catch (e) {
      console.log(e);

      console.log("Failed: deleteing rejected applications...");
    } finally {
      console.log("Done: deleteing rejected applications...");
    }
  }
}
