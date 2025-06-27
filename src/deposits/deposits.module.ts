import { Module } from "@nestjs/common";
import { DepositsService } from "./deposits.service";
import { DepositsController } from "./deposits.controller";
import { UsersService } from "src/users/users.service";
import { NotesService } from "src/notes/note.service";

@Module({
  controllers: [DepositsController],
  providers: [DepositsService, UsersService, NotesService],
})
export class DepositsModule {}
