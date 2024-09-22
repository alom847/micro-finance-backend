import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
// import { Cache } from 'cache-manager';
// import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Prisma } from '@prisma/client';

@Injectable()
export class SettingsService {
  constructor(
    // @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly databaseService: DatabaseService,
  ) {}

  async upsertSetting(key: string, value: string) {
    const setting = await this.databaseService.settings.upsert({
      where: {
        key: key,
      },
      create: {
        key,
        value,
      },
      update: {
        value,
      },
    });

    // await this.cacheManager.set(key, setting);

    return { status: true, data: setting };
  }

  async getSettingByKey(key: string) {
    // const cachedSetting = await this.cacheManager.get(key);
    // if (cachedSetting) {
    //   return {
    //     status: true,
    //     data: cachedSetting as { id: number; key: string; value: string },
    //     cachehit: true,
    //   };
    // }

    const setting = await this.databaseService.settings.findUnique({
      where: {
        key,
      },
    });

    if (setting) {
      // await this.cacheManager.set(key, setting, 0);
      return { status: true, data: setting };
    } else {
      return { status: false, message: 'setting not found' };
    }
  }

  async getSettings() {
    const settings = await this.databaseService.settings.findMany();

    return { status: true, data: settings };
  }

  async deleteSettingByKey(key: string) {
    await this.databaseService.settings.delete({
      where: {
        key,
      },
    });

    // const cachedSetting = await this.cacheManager.get(key);
    // if (cachedSetting) {
    //   await this.cacheManager.del(key);
    // }

    return { status: true, message: 'Setting deleted Succesfully' };
  }
}
