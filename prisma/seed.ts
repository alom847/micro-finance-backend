import { PrismaClient } from "@prisma/client";
import CryptoJS from "crypto-js";

const prisma = new PrismaClient();

async function createAdminAccount() {
  const hash_password = CryptoJS.AES.encrypt(
    process.env.ADMIN_PASS as string,
    process.env.SALT as string
  ).toString();

  const admin = await prisma.user.create({
    data: {
      name: "ADMIN USER",
      password: hash_password,
      phone: "1234567890",
      email: process.env.ADMIN_EMAIL as string,
      image: "/assets/images/logo-dark.png",
      role: "Admin",
      ac_status: true,
    },
  });

  await prisma.wallets.create({
    data: {
      owner: {
        connect: {
          id: admin.id,
        },
      },
    },
  });
}

async function main() {
}

main()
  .then(async () => {
    await prisma.$disconnect();
    ``;
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
