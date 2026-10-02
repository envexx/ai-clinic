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

  console.log("\nAll smoke checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
