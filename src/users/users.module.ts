import { Module } from "@nestjs/common";
import { UsersService } from "./users.service";
import { UsersController } from "./users.controller";
import { NotesService } from "src/notes/note.service";

@Module({
  controllers: [UsersController],
  providers: [UsersService, NotesService],
})
export class UsersModule {}
