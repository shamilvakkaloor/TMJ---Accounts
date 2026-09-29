import { norm } from "./utils.js";
import { cardPages } from "./cards.js";

export function filterCardRecords(state, filters) {
  const houses = new Map(state.houses.map(h => [h.id, h]));
  const counts = new Map();
  for (const member of state.members) counts.set(member.houseId, (counts.get(member.houseId) || 0) + 1);
  const members = filters.type !== "house";
  return (members ? state.members : state.houses).filter(record => {
    const house = members ? houses.get(record.houseId) : record;
    return (!filters.subMahalId || house?.subMahalId === filters.subMahalId)
      && (!filters.houseId || house?.id === filters.houseId)
      && (!filters.status || record.active === (filters.status === "active"))
      && (!members || !filters.approval || record.approved === (filters.approval === "approved"))
      && (members || !filters.occupancy || Boolean(counts.get(record.id)) === (filters.occupancy === "occupied"))
      && (!filters.from || Boolean(record.joined) && record.joined >= filters.from)
      && (!filters.to || Boolean(record.joined) && record.joined <= filters.to)
      && (!filters.search || norm(`${record.id} ${record.name} ${record.careOf || ""} ${house?.id || ""} ${house?.name || ""} ${house?.number || ""}`).includes(norm(filters.search)));
  }).slice().sort((a, b) => {
    const field = filters.sort === "id" ? "id" : "name";
    return a[field].localeCompare(b[field], undefined, { numeric: true }) || a.id.localeCompare(b.id);
  });
}
export function bulkCardParts(state, type, ids, pageLimit = 100) {
  if (!Number.isInteger(pageLimit) || pageLimit < 1) throw new Error("Invalid PDF page limit.");
  const pages = [...new Set(ids)].flatMap(id => cardPages(state, type, id));
  const parts = [];
  for (let i = 0; i < pages.length; i += pageLimit) parts.push(pages.slice(i, i + pageLimit));
  return parts;
}
