/**
 * End-to-end smoke test against a running dev/prod server.
 * Usage: pnpm smoke   (optionally SMOKE_BASE_URL=http://host:port)
 */

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const STAFF_EMAIL = process.env.SMOKE_STAFF_EMAIL ?? "admin@wellnest.demo";
const STAFF_PASSWORD = process.env.SMOKE_STAFF_PASSWORD ?? "demo-password";

function cookieFrom(response, name) {
  const raw = response.headers.getSetCookie();
  for (const entry of raw) {
    const [pair] = entry.split(";");
    const [key, ...rest] = pair.split("=");
    if (key.trim() === name) return `${key.trim()}=${rest.join("=")}`;
  }
  return null;
}

async function waitForHealth() {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    try {
      const response = await fetch(`${BASE}/api/health`);
      if (response.ok) return response.json();
    } catch {
      // server not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Server at ${BASE} did not become ready`);
}

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
  console.log(`  ok - ${message}`);
}

async function main() {
  const health = await waitForHealth();
  console.log("health:", JSON.stringify(health));
  assert(health.success === true && health.data.db === "up", "health reports db up");

  // --- guest session ---
  const guestRes = await fetch(`${BASE}/api/guest-session`, { method: "POST" });
  const guestBody = await guestRes.json();
  const guestCookie = cookieFrom(guestRes, "ai_clinic_guest");
  assert(guestRes.status === 201, "guest session created (201)");
  assert(Boolean(guestCookie), "guest cookie is set");
  assert(Boolean(guestBody.data?.guestSessionId), "guest session id returned");

  const meGuest = await fetch(`${BASE}/api/me`, {
    headers: { cookie: guestCookie },
  }).then((r) => r.json());
  assert(meGuest.data.type === "guest", "guest cookie resolves to guest actor");

  // --- staff login ---
  const loginRes = await fetch(`${BASE}/api/staff/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: BASE,
    },
    body: JSON.stringify({ email: STAFF_EMAIL, password: STAFF_PASSWORD }),
  });
  const loginBody = await loginRes.json();
  const staffCookie = cookieFrom(loginRes, "ai_clinic_staff");
  assert(loginRes.ok && loginBody.data?.role === "ADMIN", "staff login returns ADMIN role");
  assert(Boolean(staffCookie), "staff cookie is set");

  const meStaff = await fetch(`${BASE}/api/me`, {
    headers: { cookie: staffCookie },
  }).then((r) => r.json());
  assert(meStaff.data.type === "staff", "staff cookie resolves to staff actor");

  // --- wrong password is rejected ---
  const badLogin = await fetch(`${BASE}/api/staff/login`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify({ email: STAFF_EMAIL, password: "wrong" }),
  });
  const badBody = await badLogin.json();
  assert(badLogin.status === 401 && badBody.code === "UNAUTHORIZED", "wrong password is rejected");

  // --- cross-origin mutation is rejected ---
  const csrf = await fetch(`${BASE}/api/staff/login`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://evil.example" },
    body: JSON.stringify({ email: STAFF_EMAIL, password: STAFF_PASSWORD }),
  });
  const csrfBody = await csrf.json();
  assert(csrf.status === 403 && csrfBody.code === "FORBIDDEN", "cross-origin mutation is rejected");

  // --- admin configuration ---
  const settings = await fetch(`${BASE}/api/admin/settings`, {
    headers: { cookie: staffCookie },
  }).then((r) => r.json());
  assert(settings.success && settings.data.timezone === "Asia/Dubai", "admin reads clinic settings");

  const services = await fetch(`${BASE}/api/admin/services`, {
    headers: { cookie: staffCookie },
  }).then((r) => r.json());
  assert(
    services.success && services.data.length >= 3,
    "admin lists seeded services",
  );

  const providers = await fetch(`${BASE}/api/admin/providers`, {
    headers: { cookie: staffCookie },
  }).then((r) => r.json());
  assert(
    providers.success && providers.data.length >= 2,
    "admin lists seeded providers",
  );

  // Invalid duration (not a multiple of 15) must be rejected by the domain rule.
  const invalidService = await fetch(`${BASE}/api/admin/services`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: BASE,
      cookie: staffCookie,
    },
    body: JSON.stringify({
      name: "Bad service",
      durationMinutes: 20,
      bufferMinutes: 0,
      priceMinor: 1000,
    }),
  });
  const invalidBody = await invalidService.json();
  assert(
    invalidService.status === 400 && invalidBody.code === "VALIDATION_ERROR",
    "service duration must be a multiple of the slot granularity",
  );

  // A guest session must not reach admin endpoints.
  const guestAdmin = await fetch(`${BASE}/api/admin/services`, {
    headers: { cookie: guestCookie },
  });
  const guestAdminBody = await guestAdmin.json();
  assert(
    guestAdmin.status === 401 && guestAdminBody.code === "UNAUTHORIZED",
    "guest cannot access admin endpoints",
  );

  // Dashboard requires a staff session.
  const dashboard = await fetch(`${BASE}/dashboard`, { redirect: "manual" });
  assert(
    dashboard.status >= 300 && dashboard.status < 400,
    "unauthenticated dashboard redirects to login",
  );

  const dashboardAuthed = await fetch(`${BASE}/dashboard`, {
    headers: { cookie: staffCookie },
  });
  const dashboardHtml = await dashboardAuthed.text();
  assert(
    dashboardAuthed.status === 200 && dashboardHtml.includes("WellNest Clinic"),
    "authenticated dashboard renders",
  );

  // Write path: provider working hours and clinic hours round-trip.
  const firstProviderId = providers.data[0].id;
  const scheduleRead = await fetch(
    `${BASE}/api/admin/schedules/${firstProviderId}`,
    { headers: { cookie: staffCookie } },
  ).then((r) => r.json());
  const saveHours = await fetch(
    `${BASE}/api/admin/schedules/${firstProviderId}`,
    {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        origin: BASE,
        cookie: staffCookie,
      },
      body: JSON.stringify({ hours: scheduleRead.data.workingHours }),
    },
  );
  const saveHoursBody = await saveHours.json();
  assert(
    saveHours.ok && saveHoursBody.success && saveHoursBody.data.length > 0,
    "provider working hours round-trip saves",
  );

  const clinicHoursRead = await fetch(`${BASE}/api/admin/clinic-hours`, {
    headers: { cookie: staffCookie },
  }).then((r) => r.json());
  const saveClinic = await fetch(`${BASE}/api/admin/clinic-hours`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      origin: BASE,
      cookie: staffCookie,
    },
    body: JSON.stringify({ hours: clinicHoursRead.data }),
  });
  const saveClinicBody = await saveClinic.json();
  assert(
    saveClinic.ok && saveClinicBody.success,
    "clinic hours round-trip saves",
  );

  const servicesPage = await fetch(`${BASE}/dashboard/services`, {
    headers: { cookie: staffCookie },
  });
  const servicesHtml = await servicesPage.text();
  assert(
    servicesPage.status === 200 &&
      servicesHtml.includes("General Consultation"),
    "services admin page renders seeded services",
  );

  // --- knowledge ---
  const knowledgeRes = await fetch(`${BASE}/api/admin/knowledge`, {
    headers: { cookie: staffCookie },
  }).then((r) => r.json());
  assert(
    knowledgeRes.success && knowledgeRes.data.length >= 15,
    "admin lists seeded knowledge documents",
  );

  const knowledgeSearch = await fetch(
    `${BASE}/api/admin/knowledge/search?q=${encodeURIComponent("opening hours")}`,
    { headers: { cookie: staffCookie } },
  ).then((r) => r.json());
  assert(
    knowledgeSearch.success && knowledgeSearch.data.length > 0,
    "knowledge retrieval returns citations",
  );

  // --- booking flow ---
  const servicesRes = await fetch(`${BASE}/api/services`).then((r) => r.json());
  assert(
    servicesRes.success && servicesRes.data.length > 0,
    "public services are listed",
  );
  const service = servicesRes.data[0];

  const availRes = await fetch(
    `${BASE}/api/availability?serviceId=${service.id}`,
  ).then((r) => r.json());
  assert(
    availRes.success && availRes.data.length > 0,
    "availability returns slots",
  );
  const slot = availRes.data[0];

  const bookingHeaders = {
    "content-type": "application/json",
    origin: BASE,
    cookie: guestCookie,
  };

  const prepRes = await fetch(`${BASE}/api/bookings`, {
    method: "POST",
    headers: bookingHeaders,
    body: JSON.stringify({
      serviceId: slot.serviceId,
      providerId: slot.providerId,
      startAt: slot.startAt,
      displayName: "Smoke Visitor",
      contact: "smoke@example.com",
      consent: true,
    }),
  });
  const prepBody = await prepRes.json();
  assert(prepRes.ok && Boolean(prepBody.data?.actionId), "booking prepared as a pending action");

  const idemKey = `smoke-${Date.now()}`;
  const confirmRes = await fetch(
    `${BASE}/api/actions/${prepBody.data.actionId}/confirm`,
    {
      method: "POST",
      headers: bookingHeaders,
      body: JSON.stringify({ idempotencyKey: idemKey }),
    },
  );
  const confirmBody = await confirmRes.json();
  assert(
    confirmRes.ok && /^WN-/.test(confirmBody.data.bookingReference),
    "booking confirmed with a reference",
  );

  const replayRes = await fetch(
    `${BASE}/api/actions/${prepBody.data.actionId}/confirm`,
    {
      method: "POST",
      headers: bookingHeaders,
      body: JSON.stringify({ idempotencyKey: idemKey }),
    },
  );
  const replayBody = await replayRes.json();
  assert(
    replayRes.ok && replayBody.data.id === confirmBody.data.id,
    "confirmation replay is idempotent",
  );

  const mineRes = await fetch(`${BASE}/api/my-appointments`, {
    headers: { cookie: guestCookie },
  }).then((r) => r.json());
  assert(
    mineRes.success &&
      mineRes.data.some((item) => item.id === confirmBody.data.id),
    "appointment appears in my-appointments",
  );

  const anonBooking = await fetch(`${BASE}/api/bookings`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify({
      serviceId: slot.serviceId,
      providerId: slot.providerId,
      startAt: slot.startAt,
      displayName: "Anon",
      contact: "anon@example.com",
      consent: true,
    }),
  });
  const anonBody = await anonBooking.json();
  assert(
    anonBooking.status === 401 && anonBody.code === "UNAUTHORIZED",
    "booking requires a guest session",
  );

  // Cleanup: cancel the smoke appointment to free the slot.
  const cancelPrep = await fetch(`${BASE}/api/bookings/cancel`, {
    method: "POST",
    headers: bookingHeaders,
    body: JSON.stringify({
      appointmentId: confirmBody.data.id,
      expectedVersion: confirmBody.data.version,
    }),
  }).then((r) => r.json());
  if (cancelPrep.success) {
    await fetch(`${BASE}/api/actions/${cancelPrep.data.actionId}/confirm`, {
      method: "POST",
      headers: bookingHeaders,
      body: JSON.stringify({ idempotencyKey: `${idemKey}-cancel` }),
    });
  }

  console.log("\nAll smoke checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
