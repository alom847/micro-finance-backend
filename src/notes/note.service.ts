import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { AuthGuard } from "src/auth/auth.guard";

@Injectable()
export class NotesService {
  constructor(private readonly databaseService: DatabaseService) {}

  async addNote(
    created_by: number,
    data: {
      content: string;
      user_id?: number;
      loan_id?: number;
      deposit_id?: number;
    }
  ) {
    return this.databaseService.notes.create({
      data: {
        created_by: created_by,
        ...data,
      },
    });
  }

  async getNotes(filter: {
    user_id?: number;
    loan_id?: number;
    deposit_id?: number;
  }) {
    return this.databaseService.notes.findMany({
      where: filter,
      include: { owner: { select: { name: true, id: true } } },
    });
  }

  async deleteNote(id: number) {
    return this.databaseService.notes.delete({ where: { id } });
  }
}
