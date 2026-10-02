-- AlterTable
ALTER TABLE "clinics" ADD COLUMN     "bookingHorizonDays" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "minimumNoticeMinutes" INTEGER NOT NULL DEFAULT 120,
ADD COLUMN     "pendingActionTtlMinutes" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "selfServiceCutoffMinutes" INTEGER NOT NULL DEFAULT 120,
ADD COLUMN     "slotGranularityMinutes" INTEGER NOT NULL DEFAULT 15;

-- CreateTable
CREATE TABLE "clinic_hours" (
    "id" UUID NOT NULL,
    "clinicId" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "localStart" TEXT NOT NULL,
    "localEnd" TEXT NOT NULL,

    CONSTRAINT "clinic_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" UUID NOT NULL,
    "clinicId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "bufferMinutes" INTEGER NOT NULL DEFAULT 0,
    "priceMinor" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "providers" (
    "id" UUID NOT NULL,
    "clinicId" UUID NOT NULL,
    "displayName" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_services" (
    "providerId" UUID NOT NULL,
    "serviceId" UUID NOT NULL,

    CONSTRAINT "provider_services_pkey" PRIMARY KEY ("providerId","serviceId")
);

-- CreateTable
CREATE TABLE "working_hours" (
    "id" UUID NOT NULL,
    "providerId" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "localStart" TEXT NOT NULL,
    "localEnd" TEXT NOT NULL,

    CONSTRAINT "working_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_exceptions" (
    "id" UUID NOT NULL,
    "providerId" UUID NOT NULL,
    "startsAt" TIMESTAMPTZ NOT NULL,
    "endsAt" TIMESTAMPTZ NOT NULL,
    "reason" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "clinic_hours_clinicId_weekday_idx" ON "clinic_hours"("clinicId", "weekday");

-- CreateIndex
CREATE UNIQUE INDEX "clinic_hours_clinicId_weekday_localStart_localEnd_key" ON "clinic_hours"("clinicId", "weekday", "localStart", "localEnd");

-- CreateIndex
CREATE INDEX "services_clinicId_active_idx" ON "services"("clinicId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "services_clinicId_name_key" ON "services"("clinicId", "name");

-- CreateIndex
CREATE INDEX "providers_clinicId_active_idx" ON "providers"("clinicId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "providers_clinicId_displayName_key" ON "providers"("clinicId", "displayName");

-- CreateIndex
CREATE INDEX "provider_services_serviceId_idx" ON "provider_services"("serviceId");

-- CreateIndex
CREATE INDEX "working_hours_providerId_weekday_idx" ON "working_hours"("providerId", "weekday");

-- CreateIndex
CREATE UNIQUE INDEX "working_hours_providerId_weekday_localStart_localEnd_key" ON "working_hours"("providerId", "weekday", "localStart", "localEnd");

-- CreateIndex
CREATE INDEX "schedule_exceptions_providerId_startsAt_endsAt_idx" ON "schedule_exceptions"("providerId", "startsAt", "endsAt");

-- AddForeignKey
ALTER TABLE "clinic_hours" ADD CONSTRAINT "clinic_hours_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "providers" ADD CONSTRAINT "providers_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_services" ADD CONSTRAINT "provider_services_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_services" ADD CONSTRAINT "provider_services_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "working_hours" ADD CONSTRAINT "working_hours_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_exceptions" ADD CONSTRAINT "schedule_exceptions_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
