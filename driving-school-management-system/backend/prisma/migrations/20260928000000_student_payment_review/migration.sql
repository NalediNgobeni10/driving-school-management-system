-- Replace the generated paid/unpaid lesson charge records with student-submitted payments.
ALTER TABLE "Booking" ADD COLUMN "paid" BOOLEAN NOT NULL DEFAULT false;

ALTER TYPE "PaymentStatus" RENAME TO "PaymentStatus_old";
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "Payment" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Payment" ALTER COLUMN "status" TYPE "PaymentStatus"
  USING (CASE "status"::text WHEN 'paid' THEN 'APPROVED' ELSE 'PENDING' END)::"PaymentStatus";
ALTER TABLE "Payment" ALTER COLUMN "status" SET DEFAULT 'PENDING';

ALTER TABLE "Payment" RENAME COLUMN "date" TO "createdAt";
ALTER TABLE "Payment" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Payment" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'ZAR';
ALTER TABLE "Payment" ADD COLUMN "method" TEXT NOT NULL DEFAULT 'OTHER';
ALTER TABLE "Payment" ADD COLUMN "reference" TEXT NOT NULL DEFAULT 'LEGACY';
ALTER TABLE "Payment" ADD COLUMN "purpose" TEXT NOT NULL DEFAULT 'Legacy lesson payment';
ALTER TABLE "Payment" ADD COLUMN "packageId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "proofFileUrl" TEXT;
ALTER TABLE "Payment" ADD COLUMN "submittedByStudent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Payment" ADD COLUMN "adminNote" TEXT;
ALTER TABLE "Payment" ADD COLUMN "reviewedBy" TEXT;
ALTER TABLE "Payment" ADD COLUMN "reviewedAt" TIMESTAMP(3);

UPDATE "Payment" SET "reference" = 'LEGACY-' || "id";
UPDATE "Payment" SET "purpose" = 'Lesson booking';
UPDATE "Payment" SET "reviewedAt" = "createdAt" WHERE "status" = 'APPROVED';
UPDATE "Payment" SET "submittedByStudent" = true WHERE "status" = 'APPROVED';
UPDATE "Booking" AS b SET "paid" = true
  WHERE EXISTS (SELECT 1 FROM "Payment" p WHERE p."bookingId" = b."id" AND p."status" = 'APPROVED');

ALTER TABLE "Payment" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "Payment" ALTER COLUMN "method" DROP DEFAULT;
ALTER TABLE "Payment" ALTER COLUMN "reference" DROP DEFAULT;
ALTER TABLE "Payment" ALTER COLUMN "purpose" DROP DEFAULT;
ALTER TABLE "Payment" ALTER COLUMN "submittedByStudent" SET DEFAULT true;

ALTER TABLE "Payment" ALTER COLUMN "bookingId" DROP NOT NULL;
DROP INDEX "Payment_bookingId_key";
CREATE INDEX "Payment_studentId_createdAt_idx" ON "Payment"("studentId", "createdAt");
CREATE INDEX "Payment_status_createdAt_idx" ON "Payment"("status", "createdAt");
CREATE INDEX "Payment_bookingId_idx" ON "Payment"("bookingId");

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reviewedBy_fkey"
  FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_bookingId_fkey";
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DROP TYPE "PaymentStatus_old";
