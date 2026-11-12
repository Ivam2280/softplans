import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { createDemoWorkspace } from "../../src/core/demo-data.js";
import { createBackup } from "../../src/core/storage.js";
import { makeWorkspace } from "../unit/fixtures.js";

const workspaceKey = "softplans.workspace.v1";

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("https://fonts.googleapis.com/**", (route) => route.abort());
  await page.route("https://fonts.gstatic.com/**", (route) => route.abort());
});

async function openComposer(page, isMobile) {
  if (isMobile) await page.locator("#mobile-fab").click();
}

async function addTask(page, isMobile, text) {
  await openComposer(page, isMobile);
  await page.locator("#task-input").fill(text);
  await page.locator("#task-input").press("Enter");
  await expect(page.locator(".task-text").filter({ hasText: text })).toHaveCount(1);
}

async function openBackups(page, isMobile) {
  if (isMobile) await page.locator("#mobile-prefs-trigger").click();
  await page.locator("[data-open-workspace]:visible").click();
  await expect(page.locator("#workspace-dialog")).toBeVisible();
}

async function readWorkspace(page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)), workspaceKey);
}

async function seed(page, value = makeWorkspace()) {
  await page.goto("./");
  await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), {
    key: workspaceKey,
    data: value,
  });
  await page.reload();
}

async function waitForVisualState(page) {
  await page.bringToFront();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(resolve));
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
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const selectors =
            ".brand-text, .filter-label, .group-name, #lang-dropdown-label, .tasks-title, .task-schedule-text";
          return [...document.querySelectorAll(selectors)]
            .filter((element) => element.getClientRects().length)
            .every((element) => {
              const style = getComputedStyle(element);
              const fill = style.getPropertyValue("-webkit-text-fill-color");
              return (
                style.color === getComputedStyle(element.parentElement).color &&
                (!fill || fill === "currentcolor" || fill === style.color)
              );
            });
        }),
      { message: "Inherited theme colors should finish updating before the accessibility scan" },
    )
    .toBe(true);
}

test("starts with sample tasks once and preserves the saved workspace", async ({ page }) => {
  await page.goto("./");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator(".task-item")).toHaveCount(10);
  const saved = await readWorkspace(page);
  expect(saved.groups).toHaveLength(4);
  expect(saved.tasks).toHaveLength(13);
  await page.reload();
  await expect(page.locator(".task-item")).toHaveCount(10);
  expect(await readWorkspace(page)).toEqual(saved);
});

test("an intentionally empty workspace stays empty after reload", async ({ page }) => {
  await seed(page, { version: 1, groups: [], tasks: [] });
  await expect(page.locator("#empty-state")).toBeVisible();
  await page.reload();
  await expect(page.locator(".task-item")).toHaveCount(0);
  expect(await readWorkspace(page)).toEqual({ version: 1, groups: [], tasks: [] });
});

test("creates, edits, flags, completes, restores and deletes a task", async ({
  page,
  isMobile,
}) => {
  await seed(page, { version: 1, groups: [], tasks: [] });
  await addTask(page, isMobile, "Review the release");
  await page.locator(".task-text").click();
  await page.locator("#task-edit-input").fill("Ship the release");
  await page.locator("#save-task-edit").click();
  await expect(page.locator(".task-text")).toHaveText("Ship the release");
  await page.locator(".favorite-button").click();
  await page.locator('[data-filter="favorites"]').click();
  await expect(page.locator(".task-item")).toHaveCount(1);
  await page.locator(".task-check").click();
  await expect(page.locator(".task-item")).toHaveCount(0);
  await page.locator('[data-filter="completed"]').click();
  await expect(page.locator(".task-check")).toBeChecked();
  await page.locator(".task-check").click();
  await page.locator('[data-filter="all"]').click();
  await expect(page.locator(".task-text")).toHaveText("Ship the release");
  await page.locator(".task-item").click({ button: "right" });
  await page.locator("#delete-task-action").click();
  await expect(page.locator(".task-item")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".task-item")).toHaveCount(0);
});

test("groups can be renamed, reordered with the keyboard and deleted atomically", async ({
  page,
  isMobile,
}) => {
  await seed(page, createDemoWorkspace());
  await page.locator("#open-group-dialog").click();
  await page.locator("#group-name").fill("Research");
  await page.locator('#group-form [type="submit"]').click();
  let group = page.locator(".group-item").filter({ hasText: "Research" });
  await group.locator("button").focus();
  await page.keyboard.press(isMobile ? "Alt+ArrowLeft" : "Alt+ArrowUp");
  expect((await readWorkspace(page)).groups.map((item) => item.name)).toEqual([
    "Product",
    "Design",
    "Personal",
    "Research",
    "Learning",
  ]);
  await group.click({ button: "right" });
  await page.locator("#edit-group-action").click();
  await page.locator("#group-name").fill("Experiments");
  await page.locator('#group-form [type="submit"]').click();
  group = page.locator(".group-item").filter({ hasText: "Experiments" });
  await group.locator("button").click();
  await addTask(page, isMobile, "Test a new idea");
  await group.click({ button: "right" });
  await page.locator("#delete-group-action").click();
  await expect(page.locator("#confirm-clear-dialog")).toBeVisible();
  await page.locator("#confirm-clear-submit").click();
  const value = await readWorkspace(page);
  expect(value.groups.some((item) => item.name === "Experiments")).toBe(false);
  expect(value.tasks.some((item) => item.text === "Test a new idea")).toBe(false);
  expect(
    value.tasks.every(
      (item) => item.groupId === null || value.groups.some((group) => group.id === item.groupId),
    ),
  ).toBe(true);
});

test("search includes completed tasks, group names and safe highlighted text", async ({
  page,
  isMobile,
}) => {
  await seed(page);
  const text = '<img src=x onerror="window.injected=true"> İstanbul';
  await addTask(page, isMobile, text);
  if (isMobile) await page.locator("#search-toggle").click();
  const search = page.locator(isMobile ? "#search-input" : "#desktop-search-input");
  await search.fill("istan");
  await expect(page.locator(".task-item")).toHaveCount(0);
  await search.fill("i̇stanbul");
  await expect(page.locator(".task-item")).toHaveCount(1);
  await expect(page.locator(".task-text")).toHaveText(text);
  await expect(page.locator(".task-text img")).toHaveCount(0);
  expect(await page.evaluate(() => window.injected)).toBeUndefined();
  await search.fill("work release");
  await expect(page.locator(".task-text")).toHaveText("Write release notes");
  await page.locator(".task-check").click();
  await expect(page.locator(".task-item.is-completed")).toHaveCount(1);
});

test("date and time pickers preserve exact minutes and support keyboard controls", async ({
  page,
  isMobile,
}) => {
  await seed(page, { version: 1, groups: [], tasks: [] });
  await openComposer(page, isMobile);
  await page.locator("#task-input").fill("A scheduled task");
  await page.locator("#task-date-control").click();
  const month = await page.locator("#dt-month-title").textContent();
  await page.locator("#dt-next-month").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#datetime-popover")).toBeVisible();
  await expect(page.locator("#dt-month-title")).not.toHaveText(month);
  await page.locator(".dt-day:not(.is-outside)").nth(10).click();
  await page.locator("#dt-apply-btn").click();
  await page.locator("#task-time-control").click();
  await page.locator("#dt-time-input").fill("09:07");
  await page.locator("#dt-time-input").press("Enter");
  await expect(page.locator("#datetime-popover")).toBeHidden();
  await expect(page.locator("#task-time")).toHaveValue("09:07");
  await page.locator("#task-time-control").click();
  await expect(page.locator("#dt-minutes-wheel .is-selected")).toHaveText("07");
  await page.locator("#dt-clear-btn").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#task-time")).toHaveValue("");
  await page.locator("#task-date-control").click();
  await page.locator("#dt-apply-btn").focus();
  await page.keyboard.press("Tab");
  expect(
    await page.evaluate(() =>
      document.querySelector("#datetime-popover").contains(document.activeElement),
    ),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.locator("#task-date-control")).toBeFocused();
  await page.locator("#task-input").press("Enter");
  await page.locator('[data-filter="scheduled"]').click();
  await expect(page.locator(".task-text")).toHaveText("A scheduled task");
});

test("exports a backup, rejects malformed imports and confirms replacement", async ({
  page,
  isMobile,
}) => {
  await seed(page);
  await openBackups(page, isMobile);
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#export-backup").click();
  const download = await downloadPromise;
  const exported = JSON.parse(await readFile(await download.path(), "utf8"));
  expect(exported.app).toBe("SoftPlans");
  expect(exported.tasks[0].text).toBe("Write release notes");
  await page.locator("#import-backup-file").setInputFiles({
    name: "broken.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"app":"SoftPlans","version":99}'),
  });
  await expect(page.locator("#workspace-dialog .dialog-status")).toContainText("not a valid");
  expect((await readWorkspace(page)).tasks).toHaveLength(1);
  const replacement = makeWorkspace({ tasks: [] });
  await page.locator("#import-backup-file").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(createBackup(replacement)),
  });
  await expect(page.locator("#confirm-clear-dialog")).toBeVisible();
  await page.locator("#cancel-confirm-clear").click();
  expect((await readWorkspace(page)).tasks).toHaveLength(1);
  await page.locator("#import-backup-file").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(createBackup(replacement)),
  });
  await expect(page.locator("#confirm-clear-dialog")).toBeVisible();
  // The previous confirmation's close event can arrive after this one opens.
  await page.locator("#confirm-clear-dialog").dispatchEvent("close");
  await page.locator("#confirm-clear-submit").click();
  await expect(page.locator("#workspace-dialog")).toBeHidden();
  expect(await readWorkspace(page)).toEqual(replacement);
  await expect(page.locator(".task-item")).toHaveCount(0);
});

test("preserves existing data and the draft when storage rejects a save", async ({
  page,
  isMobile,
}) => {
  await seed(page);
  const original = await readWorkspace(page);
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Full", "QuotaExceededError");
    };
  });
  await openComposer(page, isMobile);
  await page.locator("#task-input").fill("Keep this draft");
  await page.locator("#task-input").press("Enter");
  await expect(page.locator("#storage-notice")).toContainText("could not be saved");
  await expect(page.locator("#task-input")).toHaveValue("Keep this draft");
  expect(await readWorkspace(page)).toEqual(original);
  await expect(page.locator(".task-text")).toHaveText("Write release notes");
  if (isMobile) await page.keyboard.press("Escape");
  await page.locator(".task-check").click();
  await expect(page.locator(".task-check")).not.toBeChecked();
  expect(await readWorkspace(page)).toEqual(original);
  await openBackups(page, isMobile);
  await page.locator("#import-backup-file").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(createBackup(makeWorkspace({ tasks: [] }))),
  });
  await page.locator("#confirm-clear-submit").click();
  await expect(page.locator("#workspace-dialog .dialog-status")).toContainText(
    "could not be saved",
  );
  expect(await readWorkspace(page)).toEqual(original);
});

test("offers recovery for corrupt data without silently overwriting it", async ({ page }) => {
  await page.goto("./");
  await page.evaluate((key) => localStorage.setItem(key, "{broken"), workspaceKey);
  await page.reload();
  await expect(page.locator("#storage-notice")).toContainText("could not be read");
  await expect(page.locator(".task-item")).toHaveCount(0);
  expect(await page.evaluate((key) => localStorage.getItem(key), workspaceKey)).toBe("{broken");
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#download-recovery").click();
  const downloaded = JSON.parse(await readFile(await (await downloadPromise).path(), "utf8"));
  expect(downloaded.records[workspaceKey]).toBe("{broken");
  await page.locator("#reset-workspace").click();
  await page.locator("#confirm-clear-submit").click();
  await expect(page.locator("#empty-state")).toBeVisible();
  expect((await readWorkspace(page)).tasks).toHaveLength(0);
});

test("reads legacy storage and migrates it on the first edit", async ({ page, isMobile }) => {
  await page.goto("./");
  await page.evaluate((data) => {
    localStorage.removeItem("softplans.workspace.v1");
    localStorage.setItem("softplans.groups.v1", JSON.stringify(data.groups));
    localStorage.setItem("softplans.tasks.v1", JSON.stringify(data.tasks));
    localStorage.setItem("softplans.language", "uk");
  }, makeWorkspace());
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "uk");
  await expect(page.locator(".task-text")).toHaveText("Write release notes");
  expect(await readWorkspace(page)).toBeNull();
  await addTask(page, isMobile, "A new task");
  expect((await readWorkspace(page)).tasks).toHaveLength(2);
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem("softplans.tasks.v1"))),
  ).toHaveLength(1);
});

test("synchronizes saved tasks between tabs", async ({ page, context, isMobile }) => {
  await seed(page, { version: 1, groups: [], tasks: [] });
  const other = await context.newPage();
  await other.goto("./");
  await addTask(page, isMobile, "Shared between tabs");
  await expect(other.locator(".task-text")).toHaveText("Shared between tabs");
  await other.close();
});

test("persists language and theme preferences", async ({ page, isMobile }) => {
  await page.goto("./");
  if (isMobile) {
    await page.locator("#mobile-prefs-trigger").click();
    await page.locator('#mobile-prefs-popover [data-lang="uk"]').click();
    await page.locator('#mobile-prefs-popover [data-theme-val="dark"]').click();
  } else {
    await page.locator("#lang-dropdown-trigger").click();
    await page.locator('#lang-dropdown-menu [data-lang="uk"]').click();
    await page.locator("#theme-toggle").click();
  }
  await expect(page.locator("html")).toHaveAttribute("lang", "uk");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "uk");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("loads compiled assets under a repository path and fits narrow screens", async ({ page }) => {
  const failed = [];
  const errors = [];
  page.on("response", (response) => {
    if (response.url().includes("127.0.0.1") && response.status() >= 400)
      failed.push(response.url());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("./");
  await expect(page.locator(".task-item")).toHaveCount(10);
  expect(new URL(page.url()).pathname).toBe("/SoftPlans/");
  expect(
    await page.locator(".brand-mark").evaluate((element) => getComputedStyle(element).borderRadius),
  ).not.toBe("0px");
  for (const [width, height] of [
    [320, 740],
    [390, 844],
    [667, 375],
    [1024, 768],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width, height });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
  }
  const manifestURL = await page.locator('link[rel="manifest"]').getAttribute("href");
  const manifest = await (await page.request.get(new URL(manifestURL, page.url()).href)).json();
  for (const icon of manifest.icons) {
    const response = await page.request.get(
      new URL(icon.src, new URL(manifestURL, page.url())).href,
    );
    expect(response.ok()).toBe(true);
  }
  expect(failed).toEqual([]);
  expect(errors).toEqual([]);
});

test("has no detected WCAG AA violations in the main views and dialogs", async ({
  page,
  isMobile,
}) => {
  await seed(page, createDemoWorkspace());
  const scan = async (theme, view) => {
    await waitForVisualState(page);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      results.violations.map(({ id, nodes }) => ({
        id,
        nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })),
      })),
      `Accessibility violations in ${theme} theme: ${view}`,
    ).toEqual([]);
  };
  for (const theme of ["light", "dark"]) {
    if (theme === "dark") {
      if (isMobile) {
        await page.locator("#mobile-prefs-trigger").click();
        await page.locator('[data-theme-val="dark"]').click();
        await page.locator("#mobile-prefs-trigger").click();
      } else await page.locator("#theme-toggle").click();
    }
    await scan(theme, "workspace");
    await openComposer(page, isMobile);
    for (const control of ["#task-date-control", "#task-time-control"]) {
      await page.locator(control).click();
      await scan(theme, control);
      await page.keyboard.press("Escape");
    }
    if (isMobile) await page.keyboard.press("Escape");
    await page.locator(".task-text").first().click();
    await scan(theme, "task editor");
    await page.locator("#task-edit-date-trigger").click();
    await scan(theme, "task editor calendar");
    await page.keyboard.press("Escape");
    await page.locator("#close-task-edit-dialog").click();
    await openBackups(page, isMobile);
    await scan(theme, "backups");
    await page.locator("#close-workspace-dialog").click();
    await page.locator("#open-group-dialog").click();
    await scan(theme, "group editor");
    await page.locator("#close-group-dialog").click();
  }
});
