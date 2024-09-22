import { Module } from '@nestjs/common';
import { DepositsService } from './deposits.service';
import { DepositsController } from './deposits.controller';

@Module({
  controllers: [DepositsController],
  providers: [DepositsService],
})
export class DepositsModule {}
