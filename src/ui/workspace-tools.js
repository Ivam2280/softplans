import { createBackup, parseBackup } from "../core/storage.js";
import { getLocalDateString } from "../core/dates.js";
import { t } from "../i18n/index.js";

export function downloadJSON(text, filename) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function createWorkspaceTools({ read, replace, recovery, confirm, notify, beforeOpen }) {
  const dialog = document.querySelector("#workspace-dialog");
  const fileInput = document.querySelector("#import-backup-file");
  let opener;

  document.querySelectorAll("[data-open-workspace]").forEach((button) => {
    button.addEventListener("click", () => {
      opener = button;
      beforeOpen();
      dialog.querySelector(".dialog-status")?.remove();
      dialog.showModal();
    });
  });
  document.querySelector("#close-workspace-dialog").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      dialog.close();
  });
  dialog.addEventListener("close", () => {
    const target = opener?.getClientRects().length
      ? opener
      : document.querySelector("#mobile-prefs-trigger");
    target?.focus({ preventScroll: true });
  });
  document.querySelector("#export-backup").addEventListener("click", () => {
    downloadJSON(createBackup(read()), `softplans-backup-${getLocalDateString()}.json`);
  });
  document.querySelector("#import-backup").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    fileInput.value = "";
    if (!file) return;
    let value;
    try {
      if (file.size > 5 * 1024 * 1024) throw new RangeError("Backup is too large.");
      value = parseBackup(await file.text());
    } catch {
      notify(t("backupInvalid"));
      return;
    }
    const apply = () => {
      if (!replace(value)) return;
      dialog.close();
      notify(t("backupImported"));
    };
    const current = read();
    if (current.tasks.length || current.groups.length || recovery()) {
      confirm({
        title: t("replaceWorkspaceTitle"),
        copy: t("replaceWorkspaceCopy"),
        submitLabel: t("replaceWorkspaceButton"),
        onConfirm: apply,
      });
    } else apply();
  });
  document.querySelector("#download-recovery").addEventListener("click", () => {
    downloadJSON(
      JSON.stringify(
        { app: "SoftPlans recovery", exportedAt: new Date().toISOString(), records: recovery() },
        null,
        2,
      ),
      `softplans-recovery-${getLocalDateString()}.json`,
    );
  });
  document.querySelector("#reset-workspace").addEventListener("click", () => {
    confirm({
      title: t("startFreshTitle"),
      copy: t("startFreshCopy"),
      submitLabel: t("startFresh"),
      onConfirm: () => {
        if (replace({ version: 1, tasks: [], groups: [] })) notify(t("workspaceReset"));
      },
    });
  });
}
