import { Module } from "@nestjs/common";
import { LoansService } from "./loans.service";
import { LoansController } from "./loans.controller";
import { UsersService } from "src/users/users.service";

@Module({
  controllers: [LoansController],
  providers: [LoansService, UsersService],
})
export class LoansModule {}
