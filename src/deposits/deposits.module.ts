import { Module } from "@nestjs/common";
import { DepositsService } from "./deposits.service";
import { DepositsController } from "./deposits.controller";
import { UsersService } from "src/users/users.service";

@Module({
  controllers: [DepositsController],
  providers: [DepositsService, UsersService],
})
export class DepositsModule {}
