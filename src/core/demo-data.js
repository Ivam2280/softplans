import { addDays, getLocalDateString } from "./dates.js";
import { createId, WORKSPACE_VERSION } from "./storage.js";

export function createDemoWorkspace(today = getLocalDateString()) {
  const groups = [
    { id: createId(), name: "Product", color: "#3478f7" },
    { id: createId(), name: "Design", color: "#b67bd5" },
    { id: createId(), name: "Personal", color: "#5dc466" },
    { id: createId(), name: "Learning", color: "#f19a38" },
  ];
  const task = (text, group, options = {}) => ({
    id: createId(),
    text,
    completed: false,
    completedAt: null,
    favorite: false,
    dueDate: null,
    dueTime: null,
    groupId: group === null ? null : groups[group].id,
    ...options,
  });
  return {
    version: WORKSPACE_VERSION,
    groups,
    tasks: [
      task("Prepare the launch brief", 0, { favorite: true, dueDate: today, dueTime: "10:00" }),
      task("Review onboarding feedback", 0, { dueDate: today, dueTime: "14:30" }),
      task("Draft the next release notes", 0, { dueDate: addDays(today, 2) }),
      task("Collect ideas for the next sprint", 0),
      task("Update the empty-state illustrations", 1, {
        favorite: true,
        dueDate: addDays(today, 1),
      }),
      task("Review the new mobile screens", 1),
      task("Pick up groceries for dinner", 2, { dueDate: today, dueTime: "18:00" }),
      task("Plan a weekend dinner with friends", 2, { dueDate: addDays(today, 4) }),
      task("Read a chapter before bed", 3),
      task("Send the project proposal", null, { favorite: true, dueDate: addDays(today, -1) }),
      task("Set up the project workspace", 0, { completed: true, completedAt: today }),
      task("Save a few design references", 1, { completed: true, completedAt: addDays(today, -1) }),
      task("Finish the weekly review", 2, { completed: true, completedAt: addDays(today, -3) }),
    ],
  };
}
