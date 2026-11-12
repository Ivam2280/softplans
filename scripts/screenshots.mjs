import { mkdir, writeFile } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";

const baseURL = process.env.SCREENSHOT_BASE_URL ?? "http://127.0.0.1:3000/";
const output = new URL("../docs/screenshots/", import.meta.url);
const settleTime = 2500;
await mkdir(output, { recursive: true });
const browser = await chromium.launch();

async function createPage(width, height, mobile = false) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
    isMobile: mobile,
    hasTouch: mobile,
    locale: "en-US",
    timezoneId: "Europe/Kyiv",
    reducedMotion: "no-preference",
  });
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date("2026-11-12T09:00:00Z"));
  await page.goto(baseURL);
  await expect(page.locator(".task-item")).toHaveCount(10);
  await page.evaluate(() => document.fonts.ready);
  return page;
}

async function capture(page, name) {
  await page.evaluate(async () => {
    if (document.activeElement instanceof HTMLInputElement) document.activeElement.blur();
    await document.fonts.ready;
  });
  await page.waitForTimeout(settleTime);
  await page.evaluate(async () => {
    const animations = document
      .getAnimations()
      .filter(
        (animation) =>
          animation.playState === "running" &&
          animation.effect?.getComputedTiming().iterations !== Infinity,
      );
    await Promise.all(animations.map((animation) => animation.finished.catch(() => {})));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  const screenshot = await page.screenshot({
    type: "webp",
    quality: 95,
    scale: "device",
    caret: "hide",
  });
  await writeFile(new URL(`${name}.webp`, output), screenshot);
  process.stdout.write(`${name}.webp\n`);
}

async function selectFilter(page, filter) {
  const button = page.locator(`[data-filter="${filter}"]`);
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
}

try {
  const desktop = await createPage(1180, 900);
  await capture(desktop, "desktop-overview");
  await selectFilter(desktop, "today");
  await capture(desktop, "desktop-today");
  await selectFilter(desktop, "scheduled");
  await capture(desktop, "desktop-scheduled");
  await selectFilter(desktop, "favorites");
  await capture(desktop, "desktop-important");
  await desktop.locator("#desktop-search-input").fill("review");
  await capture(desktop, "desktop-search");
  await desktop.locator("#desktop-search-input").press("Escape");
  await selectFilter(desktop, "today");
  await desktop
    .getByRole("button", { name: "Edit task: Prepare the launch brief", exact: true })
    .click();
  await expect(desktop.locator("#task-edit-dialog")).toBeVisible();
  await capture(desktop, "desktop-task-editor");
  await desktop.locator("#close-task-edit-dialog").click();
  await desktop.locator("#task-date-control").click();
  await expect(desktop.locator("#datetime-popover")).toBeVisible();
  await capture(desktop, "desktop-date-picker");
  await desktop.keyboard.press("Escape");
  await desktop.locator("#theme-toggle").click();
  await expect(desktop.locator("html")).toHaveAttribute("data-theme", "dark");
  await capture(desktop, "desktop-dark");
  await desktop.context().close();

  const mobile = await createPage(390, 844, true);
  await capture(mobile, "mobile-overview");
  await mobile.locator("#mobile-fab").click();
  await mobile.locator("#task-input").fill("Plan the next product update");
  await capture(mobile, "mobile-task-composer");
  await mobile.locator("#task-date-control").click();
  await capture(mobile, "mobile-date-picker");
  await mobile.keyboard.press("Escape");
  await mobile.keyboard.press("Escape");
  await mobile
    .getByRole("button", { name: "Edit task: Prepare the launch brief", exact: true })
    .click();
  await expect(mobile.locator("#task-edit-dialog")).toBeVisible();
  await capture(mobile, "mobile-task-editor");
  await mobile.locator("#close-task-edit-dialog").click();
  await selectFilter(mobile, "completed");
  await capture(mobile, "mobile-completed");
  await mobile.locator("#mobile-prefs-trigger").click();
  await mobile.locator('[data-theme-val="dark"]').click();
  await expect(mobile.locator("html")).toHaveAttribute("data-theme", "dark");
  await capture(mobile, "mobile-dark-settings");
  await mobile.context().close();

  const tablet = await createPage(1024, 768, true);
  await selectFilter(tablet, "today");
  await capture(tablet, "tablet-today");
  await tablet.locator(".group-filter-button").filter({ hasText: "Design" }).click();
  await capture(tablet, "tablet-design-group");
  await selectFilter(tablet, "completed");
  await capture(tablet, "tablet-completed");
  await tablet.locator("[data-open-workspace]:visible").click();
  await expect(tablet.locator("#workspace-dialog")).toBeVisible();
  await capture(tablet, "tablet-backups");
  await tablet.context().close();
} finally {
  await browser.close();
}
