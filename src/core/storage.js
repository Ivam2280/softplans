import { GROUP_COLORS, LEGACY_GROUP_COLOR_MAP, STORAGE_KEYS } from "./config.js";
import { isValidDate, isValidTime } from "./dates.js";

export const WORKSPACE_VERSION = 1;
const allowedColors = new Set(GROUP_COLORS.map(({ value }) => value));

export function createId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  );
}

export function emptyWorkspace() {
  return { version: WORKSPACE_VERSION, groups: [], tasks: [] };
}

export function normalizeWorkspace(value, { strict = true } = {}) {
  if (
    !value ||
    value.version !== WORKSPACE_VERSION ||
    !Array.isArray(value.groups) ||
    !Array.isArray(value.tasks)
  ) {
    throw new TypeError("Unsupported workspace format.");
  }
  const groupIds = new Set();
  const groups = [];
  for (const group of value.groups) {
    const color = LEGACY_GROUP_COLOR_MAP[group?.color] ?? group?.color;
    if (
      !group ||
      typeof group.id !== "string" ||
      !group.id.trim() ||
      groupIds.has(group.id) ||
      typeof group.name !== "string" ||
      !group.name.trim() ||
      !allowedColors.has(color)
    ) {
      if (strict) throw new TypeError("Invalid group in workspace.");
      continue;
    }
    groupIds.add(group.id);
    groups.push({ id: group.id, name: group.name.trim(), color });
  }
  const taskIds = new Set();
  const tasks = [];
  for (const task of value.tasks) {
    if (
      !task ||
      typeof task.id !== "string" ||
      !task.id.trim() ||
      taskIds.has(task.id) ||
      typeof task.text !== "string" ||
      !task.text.trim() ||
      typeof task.completed !== "boolean"
    ) {
      if (strict) throw new TypeError("Invalid task in workspace.");
      continue;
    }
    if (
      strict &&
      ((task.dueDate !== null && task.dueDate !== undefined && !isValidDate(task.dueDate)) ||
        (task.dueTime !== null &&
          task.dueTime !== undefined &&
          (!isValidTime(task.dueTime) || !task.dueDate)) ||
        (task.completedAt !== null &&
          task.completedAt !== undefined &&
          (!task.completed || !isValidDate(task.completedAt))) ||
        (task.groupId !== null && task.groupId !== undefined && !groupIds.has(task.groupId)) ||
        (task.favorite !== undefined && typeof task.favorite !== "boolean"))
    )
      throw new TypeError("Invalid task metadata in workspace.");
    taskIds.add(task.id);
    const dueDate = isValidDate(task.dueDate) ? task.dueDate : null;
    tasks.push({
      id: task.id,
      text: task.text.trim(),
      completed: task.completed,
      completedAt: task.completed && isValidDate(task.completedAt) ? task.completedAt : null,
      favorite: task.favorite === true,
      dueDate,
      dueTime: dueDate && isValidTime(task.dueTime) ? task.dueTime : null,
      groupId: groupIds.has(task.groupId) ? task.groupId : null,
    });
  }
  return { version: WORKSPACE_VERSION, groups, tasks };
}

export function loadWorkspace(storage) {
  const raw = {};
  let store;
  try {
    store = storage ?? globalThis.localStorage;
    raw[STORAGE_KEYS.workspace] = store.getItem(STORAGE_KEYS.workspace);
    if (raw[STORAGE_KEYS.workspace] !== null) {
      try {
        return {
          data: normalizeWorkspace(JSON.parse(raw[STORAGE_KEYS.workspace])),
          status: "saved",
        };
      } catch {
        return { data: emptyWorkspace(), status: "invalid", raw };
      }
    }
    raw[STORAGE_KEYS.groups] = store.getItem(STORAGE_KEYS.groups);
    raw[STORAGE_KEYS.tasks] = store.getItem(STORAGE_KEYS.tasks);
  } catch {
    return { data: emptyWorkspace(), status: "unavailable", raw };
  }
  if (raw[STORAGE_KEYS.groups] === null && raw[STORAGE_KEYS.tasks] === null) {
    return { data: emptyWorkspace(), status: "empty" };
  }
  try {
    const data = normalizeWorkspace(
      {
        version: WORKSPACE_VERSION,
        groups: JSON.parse(raw[STORAGE_KEYS.groups] ?? "[]"),
        tasks: JSON.parse(raw[STORAGE_KEYS.tasks] ?? "[]"),
      },
      { strict: false },
    );
    return { data, status: "legacy" };
  } catch {
    return { data: emptyWorkspace(), status: "invalid", raw };
  }
}

export function saveWorkspace(value, storage) {
  try {
    const store = storage ?? globalThis.localStorage;
    store.setItem(STORAGE_KEYS.workspace, JSON.stringify(normalizeWorkspace(value)));
    return true;
  } catch {
    return false;
  }
}

export function loadPreference(key, fallback, allowedValues, storage) {
  try {
    const value = (storage ?? globalThis.localStorage).getItem(key);
    return allowedValues.includes(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

export function savePreference(key, value, storage) {
  try {
    (storage ?? globalThis.localStorage).setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function createBackup(value) {
  return JSON.stringify(
    { app: "SoftPlans", exportedAt: new Date().toISOString(), ...normalizeWorkspace(value) },
    null,
    2,
  );
}

export function parseBackup(text) {
  const value = JSON.parse(text);
  if (value?.app !== "SoftPlans") throw new TypeError("Not a SoftPlans backup.");
  return normalizeWorkspace(value);
}
