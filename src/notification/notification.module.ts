import { Global, Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { HttpModule } from '@nestjs/axios';

@Global()
@Module({
  imports: [HttpModule],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
