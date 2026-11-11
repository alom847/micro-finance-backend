import { Injectable, Logger } from "@nestjs/common";
import * as path from "path";
import * as sharp from "sharp";
import { AwsStorageAdapter } from "./adapters/aws-storage.adapter";
import { LocalStorageAdapter } from "./adapters/local-storage.adapter";
import {
  STORAGE_DRIVERS,
  StorageAdapter,
  StorageDriver,
} from "./adapters/storage-adapter.interface";

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly FOLDER = "images";
  private readonly driver: StorageDriver;
  private readonly adapter: StorageAdapter;

  constructor() {
    const driver = (process.env.STORAGE_DRIVER || "aws").toLowerCase();

    if (!STORAGE_DRIVERS.includes(driver as StorageDriver)) {
      throw new Error(
        `Invalid STORAGE_DRIVER "${driver}". Use one of: ${STORAGE_DRIVERS.join(", ")}`
      );
    }

    this.driver = driver as StorageDriver;
    this.adapter =
      this.driver === "local" ? new LocalStorageAdapter() : new AwsStorageAdapter();

    this.logger.log(`Using "${this.driver}" storage driver`);
  }

  async upload(fileName: string, file: Buffer, optimize: boolean = true) {
    let body = file;

    if (optimize) {
      body = await this.optimizeImage(file);
    }

    const key = `${this.FOLDER}/${Date.now()}-${this.sanitize(fileName)}`;

    return this.adapter.save(key, body);
  }

  /** Strip any directory parts and unsafe characters from a client-supplied name. */
  private sanitize(fileName: string): string {
    const base = path.basename(fileName || "file");
    const clean = base.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "");
    return clean || "file";
  }

  private async optimizeImage(file: Buffer): Promise<Buffer> {
    return sharp(file)
      .resize(512, 512, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 60 })
      .toBuffer();
  }
}
