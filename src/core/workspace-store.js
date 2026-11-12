import { emptyWorkspace, loadWorkspace, normalizeWorkspace, saveWorkspace } from "./storage.js";

export function createWorkspaceStore(storage) {
  let loaded = loadWorkspace(storage);
  let committed = structuredClone(loaded.data);
  let lastError = null;

  return {
    read: () => structuredClone(committed),
    get status() {
      return loaded.status;
    },
    get raw() {
      return loaded.raw ?? null;
    },
    get lastError() {
      return lastError;
    },
    save(next, { allowRecovery = false } = {}) {
      if (!allowRecovery && (loaded.status === "invalid" || loaded.status === "unavailable")) {
        lastError = loaded.status;
        return false;
      }
      let value;
      try {
        value = normalizeWorkspace(next);
      } catch {
        lastError = "invalid-input";
        return false;
      }
      if (!saveWorkspace(value, storage)) {
        lastError = "write";
        return false;
      }
      committed = structuredClone(value);
      loaded = { data: value, status: "saved" };
      lastError = null;
      return true;
    },
    reload() {
      loaded = loadWorkspace(storage);
      if (loaded.status === "invalid" || loaded.status === "unavailable") {
        lastError = loaded.status;
        return false;
      }
      committed = structuredClone(loaded.data ?? emptyWorkspace());
      lastError = null;
      return true;
    },
  };
}
