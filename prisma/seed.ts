import "dotenv/config";

import { createHash } from "node:crypto";

import { prisma } from "../src/lib/db";
import { hashPassword } from "../src/modules/auth/password";
import { embedText } from "../src/modules/knowledge/embeddings";
import { saveEmbedding } from "../src/modules/knowledge/vector-store";

const KNOWLEDGE: { title: string; sourceLabel: string; content: string }[] = [
  {
    title: "Clinic profile",
    sourceLabel: "clinic-handbook",
    content:
      "WellNest Clinic is a wellness and aesthetics clinic in Dubai offering general consultations, dental cleaning and skin consultations. All information here is administrative only; the clinic does not provide diagnosis or treatment advice through chat.",
  },
  {
    title: "Location and directions",
    sourceLabel: "clinic-handbook",
    content:
      "WellNest Clinic is located in Dubai, United Arab Emirates. Detailed directions and landmark information are available from the front desk. Please arrive about ten minutes before your appointment.",
  },
  {
    title: "Opening hours",
    sourceLabel: "clinic-handbook",
    content:
      "The clinic is open Monday to Friday from 09:00 to 18:00 and Saturday from 10:00 to 14:00. The clinic is closed on Sunday. Appointments outside these hours are not available.",
  },
  {
    title: "Services overview",
    sourceLabel: "service-catalog",
    content:
      "WellNest Clinic offers General Consultation, Dental Cleaning and Skin Consultation. Each service has a fixed duration and a fixed price. Availability is shown when you book, using the current clinic configuration.",
  },
  {
    title: "Prices",
    sourceLabel: "service-catalog",
    content:
      "Service prices are fixed and are always shown from the clinic booking system at the time of booking. Staff can confirm the current price for any service. Chat answers never invent a price.",
  },
  {
    title: "How to book an appointment",
    sourceLabel: "clinic-handbook",
    content:
      "Use the booking page to choose a service and an available time, enter your name and one contact detail, review the summary, then confirm. Nothing is saved until you confirm, and a booking reference is shown afterwards.",
  },
  {
    title: "Booking policy",
    sourceLabel: "clinic-handbook",
    content:
      "Appointments can be booked up to 30 days ahead and require at least 2 hours notice. Each provider serves one patient at a time. Offers shown are not reservations until confirmed.",
  },
  {
    title: "Cancellation policy",
    sourceLabel: "clinic-handbook",
    content:
      "You can cancel online up to 2 hours before the appointment starts. Later cancellations must be requested from the front desk. Cancelling frees the time slot for other patients.",
  },
  {
    title: "Reschedule policy",
    sourceLabel: "clinic-handbook",
    content:
      "You can reschedule online up to 2 hours before the appointment. The change is applied only if the new time is confirmed; otherwise your original appointment stays unchanged.",
  },
  {
    title: "What to bring",
    sourceLabel: "clinic-handbook",
    content:
      "Please bring a photo ID and, if relevant, any referral paperwork. For dental cleaning, avoid eating heavily right before the appointment. This is administrative guidance, not medical advice.",
  },
  {
    title: "Payment methods",
    sourceLabel: "clinic-handbook",
    content:
      "Payment is handled at the clinic front desk. The clinic accepts major cards. Online payment and deposits are not part of the current service.",
  },
  {
    title: "Insurance",
    sourceLabel: "clinic-handbook",
    content:
      "WellNest Clinic does not process insurance claims directly in this service. Please contact the front desk to discuss your situation before booking if this matters to you.",
  },
  {
    title: "Languages spoken",
    sourceLabel: "clinic-handbook",
    content:
      "Our front desk team speaks Arabic and English. If you need another language, ask the front desk and we will do our best to help.",
  },
  {
    title: "Children and companions",
    sourceLabel: "clinic-handbook",
    content:
      "One companion may accompany a patient. Please mention if a child will attend so the clinic can plan the appointment accordingly.",
  },
  {
    title: "Late arrival",
    sourceLabel: "clinic-handbook",
    content:
      "If you arrive late, the clinic may need to shorten your appointment or reschedule it based on the next patient. Please contact the front desk as soon as you know you are delayed.",
  },
];

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

  let indexedDocs = 0;
  for (const entry of KNOWLEDGE) {
    let document = await prisma.knowledgeDocument.findFirst({
      where: { clinicId: clinic.id, title: entry.title },
    });

    if (!document) {
      document = await prisma.knowledgeDocument.create({
        data: {
          clinicId: clinic.id,
          title: entry.title,
          versions: {
            create: {
              content: entry.content,
              hash: createHash("sha256").update(entry.content).digest("hex"),
              sourceLabel: entry.sourceLabel,
              approvalStatus: "APPROVED",
              indexingStatus: "INDEXING",
            },
          },
        },
      });
    }

    const version = await prisma.knowledgeVersion.findFirst({
      where: { documentId: document.id },
      orderBy: { createdAt: "desc" },
    });
    if (!version) continue;

    if (version.indexingStatus !== "READY") {
      const vector = await embedText(`${entry.title}\n${version.content}`);
      await saveEmbedding(version.id, vector);
      await prisma.knowledgeVersion.update({
        where: { id: version.id },
        data: { indexingStatus: "READY", indexedAt: new Date() },
      });
      await prisma.knowledgeDocument.update({
        where: { id: document.id },
        data: { activeVersionId: version.id },
      });
      indexedDocs += 1;
    }
  }

  console.log(
    `Seeded "${clinic.name}": ${STAFF.length} staff, ${SERVICES.length} services, ${PROVIDERS.length} providers, ${KNOWLEDGE.length} knowledge documents (${indexedDocs} newly indexed).`,
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
