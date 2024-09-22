-- CreateTable
CREATE TABLE `user` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `phone` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `password` VARCHAR(191) NOT NULL,
    `alternate_phone` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `image` VARCHAR(191) NULL,
    `role` ENUM('Admin', 'Manager', 'Agent', 'User') NOT NULL DEFAULT 'User',
    `kyc_verified` BOOLEAN NOT NULL DEFAULT false,
    `ac_status` BOOLEAN NOT NULL DEFAULT false,
    `address` VARCHAR(191) NULL,
    `mother_name` VARCHAR(191) NULL,
    `father_name` VARCHAR(191) NULL,
    `nominee_name` VARCHAR(191) NULL,
    `current_address` VARCHAR(191) NULL,
    `current_district` VARCHAR(191) NULL,
    `current_city` VARCHAR(191) NULL,
    `current_zip` VARCHAR(191) NULL,
    `current_state` VARCHAR(191) NULL,
    `district` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `zip` VARCHAR(191) NULL,
    `state` VARCHAR(191) NULL,
    `country` VARCHAR(191) NULL,
    `date_of_birth` VARCHAR(191) NULL,
    `maritial_status` VARCHAR(191) NULL,
    `gender` VARCHAR(191) NULL,
    `profession` VARCHAR(191) NULL,
    `annual_turnover` DECIMAL(11, 2) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `permissions` VARCHAR(191) NULL,

    UNIQUE INDEX `user_phone_key`(`phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wallets` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `balance` DECIMAL(20, 7) NULL DEFAULT 0.0000000,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `wallets_user_id_key`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `transactions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `wallet_id` INTEGER NOT NULL,
    `amount` DECIMAL(20, 7) NULL DEFAULT 0.0000000,
    `fee` DECIMAL(20, 7) NULL DEFAULT 0.0000000,
    `balance` DECIMAL(11, 2) NULL DEFAULT 0.00,
    `txn_type` ENUM('Credit', 'Debit', 'Disburshed', 'Settlement', 'PrematureClosed', 'MatureClosed', 'ApprovedWithdrawal') NOT NULL DEFAULT 'Credit',
    `txn_status` ENUM('Pending', 'Processing', 'Completed', 'Failed', 'Rejected') NOT NULL DEFAULT 'Completed',
    `txn_note` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,

    INDEX `transactions_wallet_id_idx`(`wallet_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `withdrawals` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `wallet_id` INTEGER NOT NULL,
    `amount` DECIMAL(20, 7) NULL DEFAULT 0.0000000,
    `status` ENUM('Pending', 'Completed', 'Rejected') NOT NULL DEFAULT 'Pending',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,
    `note` VARCHAR(191) NULL,

    INDEX `withdrawals_wallet_id_idx`(`wallet_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `kyc_verifications` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `selfie` VARCHAR(191) NULL,
    `id_proof_front` VARCHAR(191) NULL,
    `id_proof_back` VARCHAR(191) NULL,
    `id_proof_type` VARCHAR(191) NULL,
    `address_proof_front` VARCHAR(191) NULL,
    `address_proof_back` VARCHAR(191) NULL,
    `address_proof_type` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,
    `status` ENUM('NotFilled', 'Pending', 'Rejected', 'Verified') NOT NULL DEFAULT 'NotFilled',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `address_proof_value` VARCHAR(191) NULL,
    `id_proof_value` VARCHAR(191) NULL,

    UNIQUE INDEX `kyc_verifications_user_id_key`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `deposit_plans` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `min_amount` DECIMAL(11, 2) NOT NULL DEFAULT 0.00,
    `max_amount` DECIMAL(11, 2) NOT NULL DEFAULT 0.00,
    `plan_name` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `interest_rate` DECIMAL(11, 2) NOT NULL DEFAULT 0.00,
    `premature_withdrawal_charge` DECIMAL(11, 2) NOT NULL DEFAULT 0.00,
    `allow_premature_withdrawal` BOOLEAN NOT NULL DEFAULT true,
    `allowed_interest_credit_frequency` VARCHAR(191) NOT NULL,
    `allowed_payment_frequency` VARCHAR(191) NULL,
    `selling` BOOLEAN NOT NULL DEFAULT true,
    `penalty_rate` DECIMAL(11, 2) NULL DEFAULT 0.00,
    `commission_rate` DECIMAL(11, 2) NULL DEFAULT 0.00,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `loan_plans` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `plan_name` VARCHAR(191) NOT NULL,
    `min_amount` DECIMAL(11, 2) NOT NULL DEFAULT 0.00,
    `max_amount` DECIMAL(11, 2) NOT NULL DEFAULT 0.00,
    `interest_rate` DECIMAL(11, 2) NOT NULL DEFAULT 0.00,
    `premature_closing_charge` DECIMAL(11, 2) NOT NULL DEFAULT 0.00,
    `allow_premature_closing` BOOLEAN NOT NULL DEFAULT true,
    `interest_frequency` VARCHAR(191) NOT NULL,
    `allowed_emi_frequency` VARCHAR(191) NOT NULL,
    `max_installments` INTEGER NOT NULL DEFAULT 0,
    `processing_fee` DECIMAL(11, 2) NULL DEFAULT 0.00,
    `penalty_rate` DECIMAL(11, 2) NULL DEFAULT 0.00,
    `commission_rate` DECIMAL(11, 2) NULL DEFAULT 0.00,
    `selling` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `loans` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ref_id` INTEGER NULL,
    `user_id` INTEGER NOT NULL,
    `plan_id` INTEGER NOT NULL,
    `amount` DECIMAL(11, 2) NOT NULL DEFAULT 0.00,
    `total_paid` DECIMAL(11, 2) NOT NULL DEFAULT 0.00,
    `emi_amount` DECIMAL(11, 2) NOT NULL DEFAULT 0.00,
    `total_payable` DECIMAL(11, 2) NOT NULL DEFAULT 0.00,
    `interest_rate` DECIMAL(11, 2) NOT NULL DEFAULT 0.00,
    `premature_closing_charge` DECIMAL(11, 2) NOT NULL DEFAULT 0.00,
    `allow_premature_closing` BOOLEAN NOT NULL DEFAULT true,
    `interest_frequency` ENUM('Daily', 'Weekly', 'Monthly', 'Quarterly', 'Yearly', 'Maturity') NOT NULL DEFAULT 'Yearly',
    `emi_frequency` ENUM('Daily', 'Weekly', 'Monthly', 'Quarterly', 'Yearly', 'Onetime', 'Anytime') NOT NULL DEFAULT 'Monthly',
    `prefered_installments` INTEGER NOT NULL,
    `overrode_installments` INTEGER NULL,
    `payment_status` ENUM('Paid', 'Due') NOT NULL DEFAULT 'Due',
    `loan_status` ENUM('Pending', 'Approved', 'Rejected', 'Active', 'Closed', 'Settlement') NOT NULL DEFAULT 'Pending',
    `maturity_date` DATETIME(3) NULL,
    `loan_date` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `remark` VARCHAR(191) NULL,
    `guarantor` JSON NULL,
    `last_repayment` DATETIME(3) NULL,

    INDEX `loans_plan_id_fkey`(`plan_id`),
    INDEX `loans_user_id_fkey`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `due_record` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `category` ENUM('Deposit', 'Loan') NOT NULL DEFAULT 'Loan',
    `plan_id` INTEGER NOT NULL,
    `emi_amount` DECIMAL(65, 30) NOT NULL,
    `paid_amount` DECIMAL(65, 30) NOT NULL DEFAULT 0.000000000000000000000000000000,
    `late_fee` DECIMAL(65, 30) NOT NULL DEFAULT 0.000000000000000000000000000000,
    `paid_fee` DECIMAL(65, 30) NOT NULL DEFAULT 0.000000000000000000000000000000,
    `due_date` DATETIME(3) NOT NULL,
    `pay_date` DATETIME(3) NULL,
    `status` ENUM('Due', 'Paid', 'PartiallyPaid', 'PartiallyFeed', 'Overdue') NOT NULL DEFAULT 'Due',

    INDEX `due_record_plan_id_idx`(`plan_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `due_emi_config` (
    `due_id` INTEGER NOT NULL,
    `emi_id` INTEGER NOT NULL,
    `amount` DECIMAL(11, 2) NOT NULL DEFAULT 0.00,
    `total_paid_amount` DECIMAL(11, 2) NOT NULL DEFAULT 0.00,
    `late_fee` DECIMAL(11, 2) NOT NULL DEFAULT 0.00,
    `total_paid_fee` DECIMAL(11, 2) NOT NULL DEFAULT 0.00,

    INDEX `due_emi_config_emi_id_idx`(`emi_id`),
    UNIQUE INDEX `due_emi_config_due_id_emi_id_key`(`due_id`, `emi_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `deposits` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ref_id` INTEGER NULL,
    `user_id` INTEGER NOT NULL,
    `plan_id` INTEGER NOT NULL,
    `amount` DECIMAL(11, 2) NOT NULL DEFAULT 0.00,
    `total_paid` DECIMAL(11, 2) NOT NULL DEFAULT 0.00,
    `category` VARCHAR(191) NOT NULL,
    `interest_rate` DECIMAL(11, 2) NOT NULL DEFAULT 0.00,
    `premature_withdrawal_charge` DECIMAL(11, 2) NOT NULL DEFAULT 0.00,
    `allow_premature_withdrawal` BOOLEAN NOT NULL DEFAULT true,
    `interest_credit_frequency` ENUM('Daily', 'Weekly', 'Monthly', 'Quarterly', 'Yearly', 'Maturity') NOT NULL DEFAULT 'Maturity',
    `payment_frequency` ENUM('Daily', 'Weekly', 'Monthly', 'Quarterly', 'Yearly', 'Onetime', 'Anytime') NOT NULL DEFAULT 'Onetime',
    `prefered_tenure` INTEGER NOT NULL,
    `maturity_date` DATETIME(3) NULL,
    `deposit_date` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `remark` VARCHAR(191) NULL,
    `nominee` JSON NULL,
    `payment_status` ENUM('Paid', 'Due') NOT NULL DEFAULT 'Due',
    `deposit_status` ENUM('Pending', 'Approved', 'Rejected', 'Active', 'Closed', 'PrematureClosed') NOT NULL DEFAULT 'Pending',

    INDEX `deposits_plan_id_fkey`(`plan_id`),
    INDEX `deposits_user_id_fkey`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `assignments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `agent_id` INTEGER NOT NULL,
    `plan_id` INTEGER NOT NULL,
    `category` ENUM('Deposit', 'Loan') NOT NULL DEFAULT 'Deposit',

    INDEX `assignments_agent_id_idx`(`agent_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `emi_records` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `plan_id` INTEGER NOT NULL,
    `category` ENUM('Deposit', 'Loan') NOT NULL DEFAULT 'Loan',
    `amount` DECIMAL(11, 2) NOT NULL DEFAULT 0.00,
    `late_fee` DECIMAL(11, 2) NOT NULL DEFAULT 0.00,
    `total_paid` DECIMAL(11, 2) NOT NULL DEFAULT 0.00,
    `pay_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `status` ENUM('Paid', 'Collected', 'Hold') NOT NULL DEFAULT 'Paid',
    `remark` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `collected_by` INTEGER NULL,
    `hold_by` INTEGER NULL,

    INDEX `emi_records_collected_by_fkey`(`collected_by`),
    INDEX `emi_records_hold_by_fkey`(`hold_by`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `password_reset` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` INTEGER NOT NULL,
    `expirs_in` DATETIME(3) NOT NULL,

    UNIQUE INDEX `password_reset_user_id_key`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

