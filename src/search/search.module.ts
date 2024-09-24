import { Module } from "@nestjs/common";
import { WalletService } from "../wallet/wallet.service";
import { SearchController } from "./search.controller";

@Module({
  controllers: [SearchController],
  providers: [],
})
export class SearchModule {}
