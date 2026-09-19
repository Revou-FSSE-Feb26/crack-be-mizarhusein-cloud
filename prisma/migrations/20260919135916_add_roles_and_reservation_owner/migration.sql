-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'CUSTOMER');

-- AlterTable
ALTER TABLE "reservations" ADD COLUMN     "userId" INTEGER;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'CUSTOMER';

-- Every account that exists before roles were introduced was created through the
-- admin flow (public sign-up did not exist), so promote them all to ADMIN.
UPDATE "users" SET "role" = 'ADMIN';

-- CreateIndex
CREATE INDEX "reservations_userId_idx" ON "reservations"("userId");

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
