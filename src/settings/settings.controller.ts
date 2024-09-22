import {
  Controller,
  Post,
  Body,
  Get,
  Request,
  UseGuards,
  Param,
  UnauthorizedException,
  Put,
  ParseIntPipe,
  Delete,
} from '@nestjs/common';
import { SettingsService } from './settings.service';
import { AuthGuard } from '../auth/auth.guard';

@UseGuards(AuthGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Post()
  UpsertSetting(@Request() req, @Body() body) {
    if (req.user.role !== 'Admin') throw new UnauthorizedException();

    return this.settingsService.upsertSetting(body.key, body.value);
  }

  @Get()
  GetSettings(@Request() req) {
    if (req.user.role !== 'Admin') throw new UnauthorizedException();

    return this.settingsService.getSettings();
  }

  @Get(':key')
  GetSetting(@Request() req, @Param('key') key: string) {
    return this.settingsService.getSettingByKey(key);
  }

  @Delete(':key')
  DeleteSetting(@Request() req, @Param('key') key: string) {
    if (req.user.role !== 'Admin') throw new UnauthorizedException();

    console.log(key);

    return this.settingsService.deleteSettingByKey(key);
  }
}
