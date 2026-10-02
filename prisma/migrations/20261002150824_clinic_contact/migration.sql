-- AlterTable
ALTER TABLE "clinics" ADD COLUMN     "address" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "website" TEXT;

-- AlterTable
ALTER TABLE "providers" ADD COLUMN     "specialty" TEXT;
