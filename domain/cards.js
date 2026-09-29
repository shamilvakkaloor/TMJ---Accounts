export function houseMembers(state, houseId) {
  return state.members.filter((member) => member.houseId === houseId)
    .slice().sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}
export function cardPages(state, type, id) {
  if (!["house", "member"].includes(type)) throw new Error("Unknown card type.");
  const record = (type === "member" ? state.members : state.houses).find((row) => row.id === id);
  if (!record) throw new Error("Record unavailable.");
  const house = type === "house" ? record : state.houses.find((row) => row.id === record.houseId);
  const base = {
    type, id, name: record.name, mahal: state.settings[0].name,
    houseId: house?.id || record.houseId || "", houseName: house?.name || "",
    number: house?.number || "", careOf: record.careOf || "",
    subMahal: state.subMahals.find((row) => row.id === house?.subMahalId)?.name || "",
  };
  const members = type === "house" ? houseMembers(state, id) : [];
  const count = Math.max(1, Math.ceil(members.length / 6));
  return Array.from({ length: count }, (_, index) => ({
    ...base, page: index + 1, pages: count, memberCount: members.length,
    members: members.slice(index * 6, index * 6 + 6).map(({ id, name, active }) => ({ id, name, active })),
  }));
}
