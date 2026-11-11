import { promises as fs } from "fs";
import * as path from "path";
import { StorageAdapter } from "./storage-adapter.interface";

/** URL path the public folder is served under (see main.ts). */
export const LOCAL_STORAGE_URL_PREFIX = "/public";

/** Absolute path of the project-root /public folder (override with LOCAL_STORAGE_DIR). */
export const localStorageRoot = () =>
  path.resolve(process.env.LOCAL_STORAGE_DIR || path.join(process.cwd(), "public"));

export class LocalStorageAdapter implements StorageAdapter {
  private readonly root = localStorageRoot();
  private readonly baseUrl = (
    process.env.LOCAL_STORAGE_BASE_URL || "http://localhost:3000"
  ).replace(/\/+$/, "");

  async save(key: string, body: Buffer): Promise<string> {
    const target = path.resolve(this.root, key);

    // Never allow a key to escape the storage root.
    if (!target.startsWith(this.root + path.sep)) {
      throw new Error("Invalid storage key");
    }

    await fs.mkdir(path.dirname(target), { recursive: true });
    // "wx" = fail instead of overwriting an existing document.
    await fs.writeFile(target, body, { flag: "wx" });

    const urlPath = key.split("/").map(encodeURIComponent).join("/");
    return `${this.baseUrl}${LOCAL_STORAGE_URL_PREFIX}/${urlPath}`;
  }
}
