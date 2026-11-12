import { formatDate, parseLocalDate } from "./dates.js";

export function normalizeSearchText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/ё/g, "е");
}

export function getSearchTokens(query = "") {
  const normalized = normalizeSearchText(query).trim();
  return normalized ? normalized.split(/\s+/).filter(Boolean) : [];
}

export function getHighlightRanges(text, tokens) {
  const normalized = normalizeSearchText(text);
  const offsets = [];
  let sourceIndex = 0;
  for (const character of text) {
    const end = sourceIndex + character.length;
    for (let index = 0; index < normalizeSearchText(character).length; index += 1) {
      offsets.push([sourceIndex, end]);
    }
    sourceIndex = end;
  }
  const ranges = [];
  for (const token of tokens) {
    if (!token) continue;
    let from = 0;
    while (from < normalized.length) {
      const index = normalized.indexOf(token, from);
      if (index === -1) break;
      ranges.push([offsets[index][0], offsets[index + token.length - 1][1]]);
      from = index + token.length;
    }
  }
  ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged = [];
  for (const range of ranges) {
    const previous = merged.at(-1);
    if (previous && range[0] <= previous[1]) previous[1] = Math.max(previous[1], range[1]);
    else merged.push(range);
  }
  return merged;
}

export function matchesSearchQuery(task, tokens, groups, locale) {
  if (!tokens.length) return true;

  const group = groups.find((item) => item.id === task.groupId);
  let dateShort = "";
  let dateLong = "";
  if (task.dueDate) {
    const parsed = parseLocalDate(task.dueDate);
    dateShort = formatDate(parsed, locale, "numericDate");
    dateLong = formatDate(parsed, locale, "long");
  }

  const haystack = normalizeSearchText(
    [
      task.text,
      group?.name || "",
      task.dueDate || "",
      dateShort,
      dateLong,
      task.dueTime || "",
    ].join(" "),
  );

  return tokens.every((token) => haystack.includes(token));
}
