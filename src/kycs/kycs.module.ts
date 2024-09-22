import { Module } from '@nestjs/common';
import { KycsService } from './kycs.service';
import { KycsController } from './kycs.controller';

@Module({
  controllers: [KycsController],
  providers: [KycsService],
})
export class KycsModule {}
