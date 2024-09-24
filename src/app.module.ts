import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { DatabaseModule } from "./database/database.module";
import { KycsModule } from "./kycs/kycs.module";
import { PlansModule } from "./plans/plans.module";
import { DepositsModule } from "./deposits/deposits.module";
import { LoansModule } from "./loans/loans.module";
import { WalletModule } from "./wallet/wallet.module";
import { StorageModule } from "./storage/storage.module";
import { UsersModule } from "./users/users.module";
import { NotificationModule } from "./notification/notification.module";
import { SettingsModule } from "./settings/settings.module";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ReportModule } from "./report/report.module";
import { RepaymentModule } from "./repayment/repayment.module";
import { EmployeeModule } from "./employee/employee.module";
import { SearchModule } from "./search/search.module";

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    DatabaseModule,
    StorageModule,
    NotificationModule,
    AuthModule,
    UsersModule,
    SettingsModule,
    PlansModule,
    DepositsModule,
    LoansModule,
    WalletModule,
    KycsModule,
    ReportModule,
    RepaymentModule,
    EmployeeModule,
    SearchModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
