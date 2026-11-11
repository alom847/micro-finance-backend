import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { StorageAdapter } from "./storage-adapter.interface";

export class AwsStorageAdapter implements StorageAdapter {
  private readonly region = process.env.AWS_S3_REGION || "ap-south-1";
  private readonly bucket = process.env.AWS_S3_BUCKET;

  private readonly s3 = new S3Client({
    region: this.region,
    credentials: {
      accessKeyId: process.env.AWS_S3_ACCESS_KEY,
      secretAccessKey: process.env.AWS_S3_SECRET_KEY,
    },
  });

  async save(key: string, body: Buffer): Promise<string> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        ACL: "public-read",
        Key: key,
        Body: body,
      })
    );

    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }
}
