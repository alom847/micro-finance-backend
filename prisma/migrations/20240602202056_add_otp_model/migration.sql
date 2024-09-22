-- CreateTable
CREATE TABLE `otp` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type` ENUM('Register', 'ResetPassword') NOT NULL,
    `identifier` VARCHAR(191) NOT NULL,
    `otp` VARCHAR(191) NOT NULL,
    `tmp_data` JSON NULL,
    `expirs_in` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
