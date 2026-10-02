import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import { chromium } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:4000";
const OUT = join("docs", "screenshots");
const EMAIL = "admin@wellnest.demo";
const PASSWORD = "demo-password";

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

const problems = [];
let shots = 0;

function dateOffset(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${BASE}/api/health`);
      if (response.ok) return;
    } catch {
      // not ready
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Server is not ready");
}

function watch(page, label) {
  page.on("pageerror", (error) => problems.push(`${label} pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") {
      problems.push(`${label} console: ${message.text()}`);
    }
  });
}

async function shot(page, name) {
  shots += 1;
  await page.screenshot({ path: join(OUT, `${name}.png`) });
  console.log(`  saved ${name}.png`);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  await waitForServer();

  const browser = await chromium.launch();

  // ---------------------------------------------------------------- visitor
  const visitorContext = await browser.newContext({
    viewport: DESKTOP,
    deviceScaleFactor: 1,
  });
  visitorContext.setDefaultTimeout(15_000);
  const visitor = await visitorContext.newPage();
  visitor.setDefaultNavigationTimeout(25_000);
  watch(visitor, "visitor");

  console.log("Visitor: landing");
  await visitor.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await visitor.getByRole("heading", { name: /never puts you on hold/i }).waitFor();
  await shot(visitor, "01-landing");

  console.log("Visitor: chat");
  await visitor.goto(`${BASE}/chat`, { waitUntil: "networkidle" });
  await shot(visitor, "02-chat");
  await visitor.getByPlaceholder("Type a message").fill("What are your opening hours?");
  await visitor.getByRole("button", { name: "Send" }).click();
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await visitor.getByText(/09:00/).last().waitFor({ timeout: 40_000 });
      break;
    } catch {
      if (attempt === 3) throw new Error("Chat did not answer in time");
      console.log("  chat is rate limited, waiting before retry…");
      await visitor.waitForTimeout(45_000);
      await visitor.goto(`${BASE}/chat`, { waitUntil: "networkidle" });
      await visitor
        .getByPlaceholder("Type a message")
        .fill("What are your opening hours?");
      await visitor.getByRole("button", { name: "Send" }).click();
    }
  }
  await shot(visitor, "03-chat-answer");

  console.log("Visitor: booking");
  await visitor.goto(`${BASE}/book`, { waitUntil: "networkidle" });
  await visitor.waitForFunction(() => {
    const select = document.querySelector("select");
    return select !== null && select.options.length > 1;
  });
  const serviceValue = await visitor
    .locator("select option", { hasText: "Dental Cleaning" })
    .first()
    .getAttribute("value");
  if (!serviceValue) throw new Error("Dental Cleaning option not found");
  await visitor.getByLabel("Service").selectOption(serviceValue);
  let booked = false;
  for (let offset = 1; offset <= 14 && !booked; offset += 1) {
    await visitor.getByLabel("Date").fill(dateOffset(offset));
    await visitor.getByRole("button", { name: "Check availability" }).click();
    await visitor.waitForTimeout(1200);
    if ((await visitor.locator('[data-testid="slot-option"]').count()) > 0) {
      booked = true;
    }
  }
  if (!booked) throw new Error("No bookable slot found in the next 14 days");
  await shot(visitor, "04-booking-slots");

  await visitor.locator('[data-testid="slot-option"]').first().click();
  await visitor.getByLabel("Full name").fill("Nadia Hassan");
  await visitor.getByLabel("Phone or email").fill("nadia.hassan@example.com");
  await visitor.getByRole("checkbox").check();
  await visitor.getByRole("button", { name: "Review booking" }).click();
  await visitor.getByRole("button", { name: "Confirm booking" }).waitFor();
  await shot(visitor, "05-booking-review");
  await visitor.getByRole("button", { name: "Confirm booking" }).click();
  const reference = await visitor
    .locator('[data-testid="booking-reference"]')
    .innerText({ timeout: 20_000 });
  if (!/^WN-/.test(reference.trim())) {
    throw new Error(`Unexpected booking reference: ${reference}`);
  }
  console.log(`  booking reference ${reference.trim()}`);
  await shot(visitor, "06-booking-confirmed");

  console.log("Visitor: my appointments");
  await visitor.goto(`${BASE}/my-appointments`, { waitUntil: "networkidle" });
  await visitor.getByText(reference.trim()).waitFor();
  await shot(visitor, "07-my-appointments");

  // ------------------------------------------------------------------ staff
  const staffContext = await browser.newContext({
    viewport: DESKTOP,
    deviceScaleFactor: 1,
  });
  staffContext.setDefaultTimeout(15_000);
  const staff = await staffContext.newPage();
  staff.setDefaultNavigationTimeout(25_000);
  watch(staff, "staff");

  console.log("Staff: login");
  await staff.goto(`${BASE}/staff/login`, { waitUntil: "networkidle" });
  if ((await staff.getByLabel("Email").inputValue()) !== EMAIL) {
    throw new Error("Login email is not pre-filled");
  }
  if ((await staff.getByLabel("Password").inputValue()) !== PASSWORD) {
    throw new Error("Login password is not pre-filled");
  }
  await shot(staff, "08-staff-login");
  await staff.getByRole("button", { name: "Sign in" }).click();
  await staff.waitForURL("**/dashboard", { timeout: 20_000 });
  await staff.getByRole("heading", { name: "WellNest Clinic" }).waitFor();
  await shot(staff, "09-dashboard");

  console.log("Staff: inbox");
  await staff.goto(`${BASE}/dashboard/inbox`, { waitUntil: "networkidle" });
  const james = staff.getByText("James Whitfield").first();
  const conversation = (await james.count())
    ? james
    : staff
        .locator('[data-testid="conversation-item"]', {
          hasNotText: "No messages yet",
        })
        .first();
  await conversation.waitFor({ timeout: 15_000 });
  await conversation.click();
  await staff.getByPlaceholder("Write a reply").waitFor();
  await shot(staff, "10-inbox-thread");

  const claim = staff.getByRole("button", { name: "Claim" });
  if (await claim.count()) {
    await claim.click();
    await staff.getByText("Assigned", { exact: false }).first().waitFor();
  }
  await staff
    .getByPlaceholder("Write a reply")
    .fill("Thanks for reaching out — I've taken over this conversation.");
  await staff.getByRole("button", { name: "Send" }).click();
  await staff
    .getByText("I've taken over this conversation")
    .last()
    .waitFor({ timeout: 15_000 });
  await shot(staff, "11-inbox-replied");

  await staff
    .getByPlaceholder("Add a staff-only note")
    .fill("Visitor asked about pricing; confirmed from the catalogue.");
  await staff.getByRole("button", { name: "Add", exact: true }).click();
  await staff
    .getByText("Visitor asked about pricing")
    .last()
    .waitFor({ timeout: 15_000 });
  await shot(staff, "12-inbox-note");

  console.log("Staff: appointments");
  await staff.goto(`${BASE}/dashboard/appointments`, { waitUntil: "networkidle" });
  await staff.getByText(reference.trim()).waitFor({ timeout: 15_000 });
  await shot(staff, "13-appointments");
  const checkIn = staff.getByRole("button", { name: "CHECKED_IN" }).first();
  if (await checkIn.count()) {
    await checkIn.click();
    // A checked-in appointment now offers the COMPLETED action.
    await staff
      .getByRole("button", { name: "COMPLETED" })
      .first()
      .waitFor({ timeout: 15_000 });
    await shot(staff, "14-appointments-checked-in");
  }

  console.log("Staff: knowledge");
  await staff.goto(`${BASE}/dashboard/knowledge`, { waitUntil: "networkidle" });
  await staff.getByText("Opening hours").first().waitFor({ timeout: 15_000 });
  await staff.getByLabel("Query").fill("opening hours");
  await staff.getByRole("button", { name: "Search" }).click();
  await staff.getByText(/score/i).first().waitFor({ timeout: 20_000 });
  await shot(staff, "15-knowledge");

  console.log("Staff: admin pages");
  await staff.goto(`${BASE}/dashboard/services`, { waitUntil: "networkidle" });
  await staff.getByText("Dental Cleaning").first().waitFor();
  await shot(staff, "16-services");

  await staff.goto(`${BASE}/dashboard/providers`, { waitUntil: "networkidle" });
  await staff.getByText("Dr. Layla Haddad").first().waitFor();
  await shot(staff, "17-providers");

  await staff.goto(`${BASE}/dashboard/schedules`, { waitUntil: "networkidle" });
  await staff.getByText("Clinic opening hours").waitFor();
  await shot(staff, "18-schedules");

  await staff.goto(`${BASE}/dashboard/settings`, { waitUntil: "networkidle" });
  await staff.getByText("Clinic settings").waitFor();
  await shot(staff, "19-settings");

  // ----------------------------------------------------------------- mobile
  const mobileContext = await browser.newContext({
    viewport: MOBILE,
    deviceScaleFactor: 1,
  });
  mobileContext.setDefaultTimeout(15_000);
  const mobile = await mobileContext.newPage();
  mobile.setDefaultNavigationTimeout(25_000);
  watch(mobile, "mobile");
  console.log("Mobile: landing + inbox");
  await mobile.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await shot(mobile, "20-landing-mobile");

  await mobile.goto(`${BASE}/staff/login`, { waitUntil: "networkidle" });
  await mobile.getByRole("button", { name: "Sign in" }).click();
  await mobile.waitForURL("**/dashboard", { timeout: 20_000 });
  await mobile.goto(`${BASE}/dashboard/inbox`, { waitUntil: "networkidle" });
  const mobileConversation = mobile
    .locator('[data-testid="conversation-item"]', { hasNotText: "No messages yet" })
    .first();
  await mobileConversation.waitFor({ timeout: 15_000 });
  await mobileConversation.click();
  await mobile.getByPlaceholder("Write a reply").waitFor();
  await shot(mobile, "21-inbox-mobile");

  await browser.close();

  if (problems.length) {
    console.error(`\nBrowser problems detected (${problems.length}):`);
    for (const problem of problems) console.error(`  - ${problem}`);
    throw new Error("End-to-end run had browser errors");
  }

  console.log(`\nEnd-to-end passed. ${shots} screenshots saved to ${OUT}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
