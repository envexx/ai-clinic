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

  console.log(
    `Seeded clinic "${clinic.name}" (${clinic.id}) and ${STAFF.length} staff users.`,
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
