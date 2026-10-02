import { mkdir } from "node:fs/promises";

import { chromium } from "@playwright/test";

const BASE = process.env.SHOTS_BASE_URL ?? "http://localhost:3000";
const OUT = "artifacts";
const EMAIL = "admin@wellnest.demo";
const PASSWORD = "demo-password";

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

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
  throw new Error("server not ready");
}

async function login(page) {
  await page.goto(`${BASE}/staff/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 20000 });
}

async function run() {
  await mkdir(OUT, { recursive: true });
  await waitForServer();

  const browser = await chromium.launch();

  async function capture(name, path, viewport, options = {}) {
    const context = await browser.newContext({
      viewport,
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    if (options.login) {
      await login(page);
    }
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    if (options.clickFirstConversation) {
      const item = page.locator('[data-testid="conversation-item"]').first();
      if (await item.count()) {
        await item.click();
        await page.waitForTimeout(1200);
      }
    }
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${OUT}/${name}.png` });
    await context.close();
    console.log("saved", `${OUT}/${name}.png`);
  }

  await capture("landing-desktop", "/", DESKTOP);
  await capture("login-desktop", "/staff/login", DESKTOP);
  await capture("chat-desktop", "/chat", DESKTOP);
  await capture("book-desktop", "/book", DESKTOP);
  await capture("dashboard-desktop", "/dashboard", DESKTOP, { login: true });
  await capture("inbox-desktop", "/dashboard/inbox", DESKTOP, {
    login: true,
    clickFirstConversation: true,
  });
  await capture("landing-mobile", "/", MOBILE);
  await capture("inbox-mobile", "/dashboard/inbox", MOBILE, {
    login: true,
    clickFirstConversation: true,
  });

  await browser.close();
  console.log("done");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
