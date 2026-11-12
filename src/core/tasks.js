import { GROUP_FILTER_PREFIX } from "./config.js";
import { addDays, formatDate, getLocalDateString, isTaskOverdue, parseLocalDate } from "./dates.js";
import { groupBy } from "./collections.js";

export const getGroupFilterId = (filter) =>
  filter.startsWith(GROUP_FILTER_PREFIX) ? filter.slice(GROUP_FILTER_PREFIX.length) : null;

export function matchesFilter(task, filter, today) {
  const groupId = getGroupFilterId(filter);
  if (groupId) return !task.completed && task.groupId === groupId;
  if (filter === "today") return !task.completed && task.dueDate === today;
  if (filter === "scheduled") return !task.completed && Boolean(task.dueDate);
  if (filter === "favorites") return !task.completed && task.favorite;
  if (filter === "completed") return task.completed;
  return !task.completed;
}

export function buildTaskBuckets(visibleTasks, effectiveFilter, { groups, t, now = new Date() }) {
  const entries = visibleTasks.map((task, index) => ({
    task,
    index,
  }));
  const items = (list) => list.map((entry) => entry.task);

  const compareBySchedule = (a, b) =>
    (a.task.dueDate || "9").localeCompare(b.task.dueDate || "9") ||
    (a.task.dueTime || "99").localeCompare(b.task.dueTime || "99") ||
    Number(b.task.favorite) - Number(a.task.favorite) ||
    a.index - b.index;

  if (effectiveFilter === "scheduled") {
    const today = getLocalDateString(now);
    const overdueEntries = entries.filter(
      (e) => e.task.dueDate < today || isTaskOverdue(e.task, now),
    );
    const upcomingEntries = entries.filter(
      (e) => e.task.dueDate >= today && !isTaskOverdue(e.task, now),
    );

    const dateBuckets = [...groupBy(upcomingEntries, (entry) => entry.task.dueDate)]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, list]) => ({
        title: formatDate(parseLocalDate(date), t("dateLocale"), "long"),
        items: items(list.sort(compareBySchedule)),
      }));

    return [
      ...(overdueEntries.length
        ? [
            {
              title: t("sectionOverdue"),
              kind: "overdue",
              items: items(overdueEntries.sort(compareBySchedule)),
            },
          ]
        : []),
      ...dateBuckets,
    ];
  }

  if (effectiveFilter === "today") {
    const overdueToday = entries.filter((e) => isTaskOverdue(e.task, now));
    const activeToday = entries.filter((e) => !isTaskOverdue(e.task, now));

    const timeBuckets = [...groupBy(activeToday, (entry) => entry.task.dueTime || "")]
      .sort(([a], [b]) => (a && b ? a.localeCompare(b) : a ? -1 : b ? 1 : 0))
      .map(([time, list]) => ({ title: time || t("noTime"), items: items(list) }));

    return [
      ...(overdueToday.length
        ? [
            {
              title: t("sectionOverdue"),
              kind: "overdue",
              items: items(overdueToday.sort(compareBySchedule)),
            },
          ]
        : []),
      ...timeBuckets,
    ];
  }

  if (effectiveFilter === "all") {
    const byGroup = groupBy(entries, (entry) =>
      groups.some((group) => group.id === entry.task.groupId) ? entry.task.groupId : null,
    );
    return [
      ...(byGroup.has(null)
        ? [{ title: t("general"), items: items(byGroup.get(null).sort(compareBySchedule)) }]
        : []),
      ...groups
        .filter((group) => byGroup.has(group.id))
        .map((group) => ({
          title: group.name,
          color: group.color,
          items: items(byGroup.get(group.id).sort(compareBySchedule)),
        })),
    ];
  }

  if (effectiveFilter === "favorites" || effectiveFilter.startsWith(GROUP_FILTER_PREFIX)) {
    const today = getLocalDateString(now);
    const open = entries.filter((entry) => !entry.task.completed);
    const sections = [
      {
        title: t("sectionOverdue"),
        kind: "overdue",
        list: open.filter((e) => isTaskOverdue(e.task, now)),
      },
      {
        title: t("filterToday"),
        list: open.filter((e) => e.task.dueDate === today && !isTaskOverdue(e.task, now)),
      },
      {
        title: t("sectionUpcoming"),
        list: open.filter((e) => e.task.dueDate && e.task.dueDate > today),
      },
      { title: t("sectionNoDate"), list: open.filter((e) => !e.task.dueDate) },
    ];

    return sections
      .filter((section) => section.list.length)
      .map(({ title, kind, list }) => ({
        title,
        kind,
        items: items(list.sort(compareBySchedule)),
      }));
  }

  if (effectiveFilter === "completed") {
    const today = getLocalDateString(now);
    const yesterday = addDays(today, -1);
    return [...groupBy(entries, (entry) => entry.task.completedAt || null)]
      .sort(([dateA], [dateB]) => {
        if (dateA === null) return dateB === null ? 0 : 1;
        if (dateB === null) return -1;
        return dateB.localeCompare(dateA);
      })
      .map(([date, list]) => {
        let title = t("completedDateUnknown");
        if (date === today) title = t("completedToday");
        else if (date === yesterday) title = t("completedYesterday");
        else if (date) title = formatDate(parseLocalDate(date), t("dateLocale"), "long");
        return { title, items: items(list) };
      });
  }

  return [{ title: "", items: items(entries) }];
}
