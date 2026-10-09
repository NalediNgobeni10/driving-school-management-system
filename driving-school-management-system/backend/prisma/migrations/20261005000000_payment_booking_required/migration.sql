-- Remove only orphan payments that cannot satisfy the required booking relationship.
DELETE FROM "Payment" WHERE "bookingId" IS NULL;

ALTER TABLE "Payment" ALTER COLUMN "bookingId" SET NOT NULL;

-- Prevent a booking deletion from nullifying a required payment foreign key.
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_bookingId_fkey";
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
