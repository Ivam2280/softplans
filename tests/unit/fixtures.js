export function makeTask(overrides = {}) {
  return {
    id: "task-1",
    text: "Write release notes",
    completed: false,
    completedAt: null,
    favorite: false,
    dueDate: null,
    dueTime: null,
    groupId: "work",
    ...overrides,
  };
}

export function makeWorkspace(overrides = {}) {
  return {
    version: 1,
    groups: [{ id: "work", name: "Work", color: "#3478f7" }],
    tasks: [makeTask()],
    ...overrides,
  };
}

export class MemoryStorage {
  data = new Map();
  writes = 0;
  failWrites = false;
  getItem(key) {
    return this.data.get(key) ?? null;
  }
  setItem(key, value) {
    if (this.failWrites) throw new DOMException("Storage is full.", "QuotaExceededError");
    this.data.set(key, String(value));
    this.writes += 1;
  }
  removeItem(key) {
    this.data.delete(key);
  }
}
