-- AlterTable
ALTER TABLE `item` ADD COLUMN `model` VARCHAR(191) NULL,
    ADD COLUMN `serialized` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `movement` ADD COLUMN `writeOffReason` ENUM('DAMAGED', 'WET', 'SPOILED', 'EXPIRED', 'LOST', 'OTHER') NULL,
    MODIFY `type` ENUM('RECEIVE', 'DISPENSE', 'SALE', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT', 'WRITE_OFF', 'RETURN') NOT NULL;

-- CreateTable
CREATE TABLE `Batch` (
    `id` VARCHAR(191) NOT NULL,
    `itemStockId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `qtyReceived` INTEGER NOT NULL,
    `qtyOnHand` INTEGER NOT NULL,
    `receivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiry` DATETIME(3) NULL,
    `note` VARCHAR(191) NULL,

    INDEX `Batch_itemStockId_idx`(`itemStockId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AssetUnit` (
    `id` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `stockId` VARCHAR(191) NULL,
    `batchId` VARCHAR(191) NULL,
    `serial` VARCHAR(191) NOT NULL,
    `status` ENUM('IN_STOCK', 'ISSUED', 'WRITTEN_OFF') NOT NULL DEFAULT 'IN_STOCK',

    UNIQUE INDEX `AssetUnit_itemId_serial_key`(`itemId`, `serial`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MovementLine` (
    `id` VARCHAR(191) NOT NULL,
    `movementId` VARCHAR(191) NOT NULL,
    `batchId` VARCHAR(191) NOT NULL,
    `qty` INTEGER NOT NULL,
    `assetUnitId` VARCHAR(191) NULL,

    INDEX `MovementLine_movementId_idx`(`movementId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Batch` ADD CONSTRAINT `Batch_itemStockId_fkey` FOREIGN KEY (`itemStockId`) REFERENCES `ItemStock`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AssetUnit` ADD CONSTRAINT `AssetUnit_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `Item`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AssetUnit` ADD CONSTRAINT `AssetUnit_stockId_fkey` FOREIGN KEY (`stockId`) REFERENCES `ItemStock`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AssetUnit` ADD CONSTRAINT `AssetUnit_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `Batch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MovementLine` ADD CONSTRAINT `MovementLine_movementId_fkey` FOREIGN KEY (`movementId`) REFERENCES `Movement`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MovementLine` ADD CONSTRAINT `MovementLine_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `Batch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MovementLine` ADD CONSTRAINT `MovementLine_assetUnitId_fkey` FOREIGN KEY (`assetUnitId`) REFERENCES `AssetUnit`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
