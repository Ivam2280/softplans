import test from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  addMonths,
  formatDate,
  getLocalDateString,
  isTaskOverdue,
  isValidDate,
  isValidTime,
  parseLocalDate,
} from "../../src/core/dates.js";
import { makeTask } from "./fixtures.js";

test("calendar dates reject impossible dates and accept leap days", () => {
  for (const value of ["2024-02-29", "2026-11-12", "0001-01-01", "0099-12-31"])
    assert.equal(isValidDate(value), true, value);
  for (const value of [
    "2026-02-29",
    "2026-04-31",
    "2026-00-01",
    "0000-01-01",
    "2026-1-1",
    "not-a-date",
    null,
  ])
    assert.equal(isValidDate(value), false, String(value));
});

test("local dates round trip without a UTC shift or the year-1900 offset", () => {
  for (const value of ["2026-03-29", "2026-10-25", "0001-01-01", "0099-12-31"])
    assert.equal(getLocalDateString(parseLocalDate(value)), value);
  assert.throws(() => parseLocalDate("2026-02-30"), RangeError);
});

test("day arithmetic crosses DST, month, and year boundaries as calendar days", () => {
  assert.equal(addDays("2026-03-28", 2), "2026-03-30");
  assert.equal(addDays("2026-10-24", 2), "2026-10-26");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2026-01-01", -1), "2025-12-31");
  assert.throws(() => addDays("0001-01-01", -1), RangeError);
});

test("month presets clamp the day to the target month's last day", () => {
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(addMonths("2024-01-31", 1), "2024-02-29");
  assert.equal(addMonths("2026-03-31", -1), "2026-02-28");
  assert.equal(addMonths("2026-12-31", 1), "2027-01-31");
  assert.throws(() => addMonths("2026-01-01", 0.5), RangeError);
});

test("times use a strict 24-hour format", () => {
  for (const value of ["00:00", "09:07", "23:59"]) assert.equal(isValidTime(value), true);
  for (const value of ["24:00", "9:07", "09:60", "12:3", "", null])
    assert.equal(isValidTime(value), false);
});

test("overdue status changes at the scheduled minute and ignores completed tasks", () => {
  const now = new Date(2026, 10, 12, 10, 30);
  assert.equal(isTaskOverdue(makeTask({ dueDate: "2026-11-11" }), now), true);
  assert.equal(isTaskOverdue(makeTask({ dueDate: "2026-11-12", dueTime: "10:29" }), now), true);
  assert.equal(isTaskOverdue(makeTask({ dueDate: "2026-11-12", dueTime: "10:30" }), now), false);
  assert.equal(isTaskOverdue(makeTask({ dueDate: "2026-11-12" }), now), false);
  assert.equal(isTaskOverdue(makeTask({ dueDate: "2026-11-11", completed: true }), now), false);
});

test("numeric dates are consistent across the three interface languages", () => {
  for (const locale of ["en-US", "ru-RU", "uk-UA"])
    assert.equal(formatDate(parseLocalDate("2026-11-12"), locale, "numericDate"), "12.11.2026");
});
