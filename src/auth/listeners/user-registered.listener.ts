import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { UserRegisteredEvent } from '../events/userRegisteredEvent';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class UserRegisteredListener {
  constructor(private readonly databaseService: DatabaseService) {}

  @OnEvent('user.registered', { async: true })
  async handleUserRegisteredEvent(payload: UserRegisteredEvent) {
    console.log(payload);
  }
}
