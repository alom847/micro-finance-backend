export interface StorageAdapter {
  /**
   * Persist a file and return a URL that can be stored in the database.
   * @param key relative object key, e.g. "images/1700000000000-photo.jpg"
   */
  save(key: string, body: Buffer): Promise<string>;
}

export const STORAGE_DRIVERS = ["aws", "local"] as const;
export type StorageDriver = (typeof STORAGE_DRIVERS)[number];
