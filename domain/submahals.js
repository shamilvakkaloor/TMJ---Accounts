export const MAX_SUB_MAHALS = 25;

export function subMahalDeletionError(state, id) {
  if (!state.subMahals.some((m) => m.id === id)) return "Sub Mahal was not found.";
  if (state.subMahals.length <= 1) return "Keep at least one Sub Mahal.";
  if (state.houses.some((h) => h.subMahalId === id || h.subHistory?.some((v) => v.value === id)))
    return "This Sub Mahal is used by a house or its assignment history. Edit it and turn off Active instead; history must be retained.";
  if (state.receipts.some((r) => r.subMahalId === id))
    return "This Sub Mahal appears on receipts. Turn off Active instead to preserve accounting history.";
  return "";
}
