import test from "node:test";
import assert from "node:assert/strict";
import { buildTaskBuckets, matchesFilter } from "../../src/core/tasks.js";
import { getHighlightRanges, getSearchTokens, matchesSearchQuery } from "../../src/core/search.js";
import { moveById, reorderByIds } from "../../src/core/collections.js";
import { createDemoWorkspace } from "../../src/core/demo-data.js";
import { normalizeWorkspace } from "../../src/core/storage.js";
import en from "../../src/i18n/en.js";
import ru from "../../src/i18n/ru.js";
import uk from "../../src/i18n/uk.js";
import { getLanguage, setLanguage, t } from "../../src/i18n/index.js";
import { makeTask, makeWorkspace } from "./fixtures.js";

const now = new Date(2026, 10, 12, 10, 30);
const options = { groups: makeWorkspace().groups, now, t: (key) => en[key] };

test("filters distinguish active, scheduled, important, completed, and custom-group tasks", () => {
  const active = makeTask({ dueDate: "2026-11-12", favorite: true });
  for (const filter of ["all", "today", "scheduled", "favorites", "group:work"])
    assert.equal(matchesFilter(active, filter, "2026-11-12"), true);
  const completed = makeTask({ completed: true });
  for (const filter of ["all", "today", "scheduled", "favorites", "group:work"])
    assert.equal(matchesFilter(completed, filter, "2026-11-12"), false);
  assert.equal(matchesFilter(completed, "completed", "2026-11-12"), true);
});

test("scheduled tasks put overdue work first and then sort upcoming dates and times", () => {
  const tasks = [
    makeTask({ id: "late", dueDate: "2026-11-11" }),
    makeTask({ id: "later", dueDate: "2026-11-13", dueTime: "14:00" }),
    makeTask({ id: "early", dueDate: "2026-11-13", dueTime: "09:00" }),
  ];
  const buckets = buildTaskBuckets(tasks, "scheduled", options);
  assert.equal(buckets[0].kind, "overdue");
  assert.deepEqual(
    buckets.flatMap((bucket) => bucket.items.map((task) => task.id)),
    ["late", "early", "later"],
  );
});

test("All groups follow the user's order, with ungrouped tasks first", () => {
  const tasks = [makeTask(), makeTask({ id: "general", groupId: null })];
  const buckets = buildTaskBuckets(tasks, "all", options);
  assert.deepEqual(
    buckets.map((bucket) => bucket.title),
    ["General", "Work"],
  );
});

test("completion history groups today, yesterday, and unknown dates", () => {
  const tasks = [
    makeTask({ id: "unknown", completed: true }),
    makeTask({ id: "yesterday", completed: true, completedAt: "2026-11-11" }),
    makeTask({ id: "today", completed: true, completedAt: "2026-11-12" }),
  ];
  assert.deepEqual(
    buildTaskBuckets(tasks, "completed", options).map((bucket) => bucket.title),
    ["Today", "Yesterday", "Unknown date"],
  );
});

test("search matches all tokens across text, group, localized date, and time", () => {
  const task = makeTask({ text: "Review Ёж branding", dueDate: "2026-11-12", dueTime: "09:07" });
  const groups = makeWorkspace().groups;
  assert.equal(matchesSearchQuery(task, getSearchTokens("ЕЖ work 09:07"), groups, "en-US"), true);
  assert.equal(
    matchesSearchQuery(task, getSearchTokens("review 12.11.2026"), groups, "en-US"),
    true,
  );
  assert.equal(matchesSearchQuery(task, getSearchTokens("review missing"), groups, "en-US"), false);
});

test("group reordering never drops items or repeats IDs", () => {
  const list = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.deepEqual(
    reorderByIds(list, ["b", "b", "missing"], (item) => item.id).map((item) => item.id),
    ["b", "a", "c"],
  );
  assert.deepEqual(
    moveById(list, "b", -1, (item) => item.id).map((item) => item.id),
    ["b", "a", "c"],
  );
});

test("the initial sample data is a valid workspace with fresh IDs and relative dates", () => {
  const first = createDemoWorkspace("2026-11-12");
  const second = createDemoWorkspace("2026-11-12");
  assert.deepEqual(normalizeWorkspace(first), first);
  assert.equal(first.groups.length, 4);
  assert.equal(first.tasks.filter((task) => !task.completed).length, 10);
  assert.equal(first.tasks.filter((task) => task.completed).length, 3);
  assert.equal(
    first.tasks.some((task) => task.dueDate === "2026-11-11"),
    true,
  );
  assert.equal(
    first.tasks.some((task) => second.tasks.some((other) => other.id === task.id)),
    false,
  );
});

test("all interface languages have the same keys and invalid language names are ignored", () => {
  const keys = Object.keys(en).sort();
  assert.deepEqual(Object.keys(ru).sort(), keys);
  assert.deepEqual(Object.keys(uk).sort(), keys);
  setLanguage("uk");
  assert.equal(t("filterToday"), "Сьогодні");
  setLanguage("__proto__");
  assert.equal(getLanguage(), "uk");
  setLanguage("en");
});

test("highlighting keeps source offsets when lowercase expands a Unicode character", () => {
  const text = "İstanbul 🦋 Ёж";
  const ranges = getHighlightRanges(text, getSearchTokens("i̇stanbul 🦋 еж"));
  assert.deepEqual(
    ranges.map(([start, end]) => text.slice(start, end)),
    ["İstanbul", "🦋", "Ёж"],
  );
  assert.deepEqual(getHighlightRanges("banana", ["ana", "ban"]), [[0, 4]]);
});
