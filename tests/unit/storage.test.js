import test from "node:test";
import assert from "node:assert/strict";
import { STORAGE_KEYS } from "../../src/core/config.js";
import {
  createBackup,
  emptyWorkspace,
  loadPreference,
  loadWorkspace,
  normalizeWorkspace,
  parseBackup,
  savePreference,
  saveWorkspace,
} from "../../src/core/storage.js";
import { createWorkspaceStore } from "../../src/core/workspace-store.js";
import { makeTask, makeWorkspace, MemoryStorage } from "./fixtures.js";

test("the storage reader returns an empty workspace without writing missing records", () => {
  const storage = new MemoryStorage();
  assert.deepEqual(loadWorkspace(storage), { data: emptyWorkspace(), status: "empty" });
  assert.equal(storage.writes, 0);
});

test("legacy tasks, groups, and group colors migrate without modifying their saved originals", () => {
  const storage = new MemoryStorage();
  const groups = [{ id: "work", name: " Work ", color: "#6396ce" }];
  const tasks = [makeTask({ dueDate: "2026-11-12", dueTime: "09:07", favorite: true })];
  storage.setItem(STORAGE_KEYS.groups, JSON.stringify(groups));
  storage.setItem(STORAGE_KEYS.tasks, JSON.stringify(tasks));
  const writes = storage.writes;
  const store = createWorkspaceStore(storage);
  assert.equal(store.status, "legacy");
  assert.deepEqual(store.read(), makeWorkspace({ tasks }));
  assert.equal(storage.writes, writes);
  assert.equal(store.save(store.read()), true);
  assert.equal(storage.getItem(STORAGE_KEYS.groups), JSON.stringify(groups));
  assert.equal(storage.getItem(STORAGE_KEYS.tasks), JSON.stringify(tasks));
  assert.equal(loadWorkspace(storage).status, "saved");
});

test("legacy orphaned group references and invalid schedule fields are safely normalized", () => {
  const storage = new MemoryStorage();
  storage.setItem(
    STORAGE_KEYS.tasks,
    JSON.stringify([makeTask({ groupId: "missing", dueDate: "2026-02-30", dueTime: "25:00" })]),
  );
  const { data } = loadWorkspace(storage);
  assert.equal(data.tasks[0].groupId, null);
  assert.equal(data.tasks[0].dueDate, null);
  assert.equal(data.tasks[0].dueTime, null);
});

test("an unreadable saved workspace is preserved and never overwritten by an ordinary edit", () => {
  const storage = new MemoryStorage();
  storage.setItem(STORAGE_KEYS.workspace, "{broken json");
  const store = createWorkspaceStore(storage);
  assert.equal(store.status, "invalid");
  assert.equal(store.raw[STORAGE_KEYS.workspace], "{broken json");
  assert.equal(store.save(makeWorkspace()), false);
  assert.equal(storage.getItem(STORAGE_KEYS.workspace), "{broken json");
  assert.equal(store.save(emptyWorkspace(), { allowRecovery: true }), true);
});

test("unavailable browser storage is handled without an exception", () => {
  const storage = {
    getItem() {
      throw new DOMException("Blocked", "SecurityError");
    },
  };
  assert.equal(loadWorkspace(storage).status, "unavailable");
  assert.equal(loadPreference("theme", "light", ["light", "dark"], storage), "light");
  assert.equal(savePreference("theme", "dark", storage), false);
});

test("a quota error keeps the previous workspace and its relationships intact", () => {
  const storage = new MemoryStorage();
  saveWorkspace(makeWorkspace(), storage);
  const before = storage.getItem(STORAGE_KEYS.workspace);
  const store = createWorkspaceStore(storage);
  const next = store.read();
  next.tasks[0].text = "Unsaved edit";
  next.groups.push({ id: "new", name: "New group", color: "#5dc466" });
  storage.failWrites = true;
  assert.equal(store.save(next), false);
  assert.deepEqual(store.read(), makeWorkspace());
  assert.equal(storage.getItem(STORAGE_KEYS.workspace), before);
});

test("deleting a group and its tasks commits as one complete workspace", () => {
  const storage = new MemoryStorage();
  saveWorkspace(makeWorkspace(), storage);
  const before = storage.writes;
  const store = createWorkspaceStore(storage);
  assert.equal(store.save(emptyWorkspace()), true);
  assert.equal(storage.writes, before + 1);
  assert.deepEqual(loadWorkspace(storage).data, emptyWorkspace());
});

test("backup export and import round trip all task fields", () => {
  const value = makeWorkspace({
    tasks: [
      makeTask({
        completed: true,
        completedAt: "2026-11-12",
        dueDate: "2026-11-11",
        dueTime: "09:07",
        favorite: true,
      }),
    ],
  });
  assert.deepEqual(parseBackup(createBackup(value)), value);
});

test("malformed backups cannot replace a workspace", () => {
  const invalid = [
    "{}",
    "null",
    "{broken",
    JSON.stringify({ app: "Different app", ...makeWorkspace() }),
    JSON.stringify({ app: "SoftPlans", ...makeWorkspace(), version: 99 }),
    JSON.stringify({ app: "SoftPlans", ...makeWorkspace({ tasks: [makeTask(), makeTask()] }) }),
    JSON.stringify({
      app: "SoftPlans",
      ...makeWorkspace({ tasks: [makeTask({ groupId: "unknown" })] }),
    }),
    JSON.stringify({
      app: "SoftPlans",
      ...makeWorkspace({ tasks: [makeTask({ dueDate: "2026-02-30" })] }),
    }),
    JSON.stringify({
      app: "SoftPlans",
      ...makeWorkspace({ groups: [{ id: "work", name: "Work", color: "url(evil)" }] }),
    }),
  ];
  for (const value of invalid) assert.throws(() => parseBackup(value));
});

test("cross-tab reload sees a complete snapshot and preserves the last good view on corruption", () => {
  const storage = new MemoryStorage();
  saveWorkspace(makeWorkspace(), storage);
  const first = createWorkspaceStore(storage);
  const second = createWorkspaceStore(storage);
  const next = second.read();
  next.tasks.push(makeTask({ id: "task-2", text: "Added in another tab" }));
  assert.equal(second.save(next), true);
  assert.equal(first.reload(), true);
  assert.equal(first.read().tasks.length, 2);
  storage.setItem(STORAGE_KEYS.workspace, "invalid");
  assert.equal(first.reload(), false);
  assert.equal(first.read().tasks.length, 2);
});

test("workspace validation rejects duplicate IDs and impossible times", () => {
  assert.throws(() =>
    normalizeWorkspace(
      makeWorkspace({ tasks: [makeTask({ dueDate: "2026-11-12", dueTime: "24:00" })] }),
    ),
  );
  assert.throws(() =>
    normalizeWorkspace(
      makeWorkspace({ groups: [...makeWorkspace().groups, ...makeWorkspace().groups] }),
    ),
  );
});
