import { Global, Injectable, NestInterceptor } from "@nestjs/common";
// import * as multer from 'multer';
// import * as multerS3 from 'multer-s3';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import * as sharp from "sharp";

@Injectable()
export class StorageService {
  private readonly REGION = "ap-south-1";
  private readonly BUCKET = "himalayan-microfin";
  private readonly FOLDER = "images";

  private readonly s3 = new S3Client({
    region: this.REGION,
    credentials: {
      accessKeyId: process.env.AWS_S3_ACCESS_KEY,
      secretAccessKey: process.env.AWS_S3_SECRET_KEY,
    },
  });

  // upload = multer({
  //   storage: multerS3({
  //     s3: this.s3,
  //     bucket: 'dragononline',
  //     acl: 'public-read',
  //     contentType: multerS3.AUTO_CONTENT_TYPE,
  //     key: function (req, file, cb) {
  //       const folder = 'images';
  //       const key =
  //         folder + '/' + Date.now().toString() + '-' + file.originalname;
  //       cb(null, key);
  //     },
  //   }),
  // });

  async upload(fileName: string, file: Buffer, optimize: boolean = true) {
    let image = file;

    if (optimize) {
      image = await this.optimizeImage(file); // Optimize the image
    }

    const key = this.FOLDER + "/" + Date.now().toString() + "-" + fileName;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.BUCKET,
        ACL: "public-read",
        Key: key,
        Body: image,
      })
    );

    const fileUrl = `https://${this.BUCKET}.s3.${this.REGION}.amazonaws.com/${key}`;

    return fileUrl;
  }

  private async optimizeImage(file: Buffer): Promise<Buffer> {
    console.log(file);

    return sharp(file)
      .resize(512, 512, {
        fit: "inside", // Resizes to fit within the 1024x1024 box
        withoutEnlargement: true, // Won't enlarge smaller images
      })
      .jpeg({ quality: 60 }) // Compress to 80% quality in JPEG format
      .toBuffer();
  }
}
