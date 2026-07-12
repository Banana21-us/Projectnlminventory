/*
  Warnings:

  - You are about to drop the column `expiryDate` on the `item` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `item` DROP COLUMN `expiryDate`;

-- AlterTable
ALTER TABLE `movement` ADD COLUMN `cancelledAt` DATETIME(3) NULL;
