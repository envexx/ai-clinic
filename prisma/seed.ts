import "dotenv/config";

import { prisma } from "../src/lib/db";
import { hashPassword } from "../src/modules/auth/password";

const CLINIC = {
  name: "WellNest Clinic",
  timezone: "Asia/Dubai",
  currency: "AED",
};

const STAFF = [
  { email: "admin@wellnest.demo", role: "ADMIN" as const },
  { email: "frontdesk@wellnest.demo", role: "RECEPTIONIST" as const },
];

// Weekday uses ISO-8601: 1=Monday .. 7=Sunday.
const CLINIC_HOURS = [
  ...[1, 2, 3, 4, 5].map((weekday) => ({
    weekday,
    localStart: "09:00",
    localEnd: "18:00",
  })),
  { weekday: 6, localStart: "10:00", localEnd: "14:00" },
];

const SERVICES = [
  {
    name: "General Consultation",
    durationMinutes: 30,
    bufferMinutes: 0,
    priceMinor: 25000,
    providers: ["Dr. Layla Haddad", "Dr. Omar Rahman"],
  },
  {
    name: "Dental Cleaning",
    durationMinutes: 45,
    bufferMinutes: 15,
    priceMinor: 40000,
    providers: ["Dr. Layla Haddad"],
  },
  {
    name: "Skin Consultation",
    durationMinutes: 30,
    bufferMinutes: 15,
    priceMinor: 35000,
    providers: ["Dr. Layla Haddad", "Dr. Omar Rahman"],
  },
];

const PROVIDERS: { displayName: string; hours: typeof CLINIC_HOURS }[] = [
  {
    displayName: "Dr. Layla Haddad",
    hours: [1, 2, 3, 4, 5].map((weekday) => ({
      weekday,
      localStart: "09:00",
      localEnd: "17:00",
    })),
  },
  {
    displayName: "Dr. Omar Rahman",
    hours: [
      ...[1, 2, 3, 4].map((weekday) => ({
        weekday,
        localStart: "10:00",
        localEnd: "18:00",
      })),
      { weekday: 6, localStart: "10:00", localEnd: "14:00" },
    ],
  },
];

async function main() {
  const password = process.env.SEED_STAFF_PASSWORD ?? "demo-password";
  const passwordHash = await hashPassword(password);

  let clinic = await prisma.clinic.findFirst({ where: { name: CLINIC.name } });
  if (!clinic) {
    clinic = await prisma.clinic.create({ data: CLINIC });
  }

  for (const staff of STAFF) {
    await prisma.staffUser.upsert({
      where: { email: staff.email },
      update: { role: staff.role, active: true, clinicId: clinic.id },
      create: {
        clinicId: clinic.id,
        email: staff.email,
        role: staff.role,
        passwordHash,
      },
    });
  }

  for (const hour of CLINIC_HOURS) {
    await prisma.clinicHour.upsert({
      where: {
        clinicId_weekday_localStart_localEnd: {
          clinicId: clinic.id,
          weekday: hour.weekday,
          localStart: hour.localStart,
          localEnd: hour.localEnd,
        },
      },
      update: {},
      create: { clinicId: clinic.id, ...hour },
    });
  }

  const providerIds = new Map<string, string>();
  for (const provider of PROVIDERS) {
    const saved = await prisma.provider.upsert({
      where: {
        clinicId_displayName: {
          clinicId: clinic.id,
          displayName: provider.displayName,
        },
      },
      update: { active: true },
      create: { clinicId: clinic.id, displayName: provider.displayName },
    });
    providerIds.set(provider.displayName, saved.id);

    // Working hours have no natural unique key beyond the triple, so replace.
    await prisma.workingHour.deleteMany({ where: { providerId: saved.id } });
    await prisma.workingHour.createMany({
      data: provider.hours.map((hour) => ({ providerId: saved.id, ...hour })),
    });
  }

  for (const service of SERVICES) {
    const saved = await prisma.service.upsert({
      where: {
        clinicId_name: { clinicId: clinic.id, name: service.name },
      },
      update: {
        durationMinutes: service.durationMinutes,
        bufferMinutes: service.bufferMinutes,
        priceMinor: service.priceMinor,
        active: true,
      },
      create: {
        clinicId: clinic.id,
        name: service.name,
        durationMinutes: service.durationMinutes,
        bufferMinutes: service.bufferMinutes,
        priceMinor: service.priceMinor,
      },
    });

    await prisma.providerService.deleteMany({ where: { serviceId: saved.id } });
    await prisma.providerService.createMany({
      data: service.providers.map((name) => ({
        providerId: providerIds.get(name)!,
        serviceId: saved.id,
      })),
    });
  }

  // One upcoming time off, created only once.
  const layla = providerIds.get("Dr. Layla Haddad")!;
  const timeOffReason = "Seed: annual leave";
  const existingTimeOff = await prisma.scheduleException.findFirst({
    where: { providerId: layla, reason: timeOffReason },
  });
  if (!existingTimeOff) {
    const start = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    start.setUTCHours(9, 0, 0, 0);
    const end = new Date(start.getTime() + 8 * 60 * 60 * 1000);
    await prisma.scheduleException.create({
      data: { providerId: layla, startsAt: start, endsAt: end, reason: timeOffReason },
    });
  }

  console.log(
    `Seeded "${clinic.name}": ${STAFF.length} staff, ${SERVICES.length} services, ${PROVIDERS.length} providers.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
