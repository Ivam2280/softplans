export function moveById(list, id, offset, idOf = (item) => item) {
  const from = list.findIndex((item) => idOf(item) === id);
  const to = Math.max(0, Math.min(list.length - 1, from + offset));
  if (from === -1 || from === to) return list;
  const copy = [...list];
  copy.splice(to, 0, copy.splice(from, 1)[0]);
  return copy;
}

export function reorderByIds(list, ids, idOf) {
  const byId = new Map(list.map((item) => [idOf(item), item]));
  const uniqueIds = [...new Set(ids)];
  const ordered = uniqueIds.map((id) => byId.get(id)).filter(Boolean);
  const included = new Set(uniqueIds);
  const missing = list.filter((item) => !included.has(idOf(item)));
  return [...ordered, ...missing];
}

export function groupBy(entries, keyOf) {
  const map = new Map();
  for (const entry of entries) {
    const key = keyOf(entry);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(entry);
  }
  return map;
}
