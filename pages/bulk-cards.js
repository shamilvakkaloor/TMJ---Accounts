import { el, button, link, input, select, field, grid, pageTitle, pagedTable, replace, alertBox, showError, badge } from "../lib/dom.js";
import { store } from "../lib/store.js";
import { filterCardRecords, bulkCardParts } from "../domain/bulk-cards.js";
import { download } from "../lib/browser.js";

export function render() {
  const selected = new Set();
  let rows = [], busy = false, cancelled = false;
  const root = el("div"), results = el("section", { class: "panel" }), exports = el("section", { class: "panel panel-body", hidden: true });
  const error = alertBox(), summary = el("p", { role: "status" }), progress = el("p", { role: "status" });
  const type = select("cardType", [["member", "Member cards"], ["house", "House cards"]], "member");
  const sub = select("subMahalId", [["", "All Sub Mahals"], ...store.state.subMahals.map(s => [s.id, s.name])], "");
  const house = select("houseId", [["", "All houses"], ...store.state.houses.map(h => [h.id, `${h.name} · ${h.id}`])], "");
  const status = select("status", [["", "All statuses"], ["active", "Active"], ["inactive", "Inactive"]], "");
  const approval = select("approval", [["", "All approvals"], ["approved", "Approved"], ["pending", "Pending approval"]], "");
  const occupancy = select("occupancy", [["", "All households"], ["occupied", "With members"], ["empty", "Without members"]], "");
  const search = input("search", "", { placeholder: "Name, ID, house or care of" });
  const from = input("from", "", { type: "date" }), to = input("to", "", { type: "date" });
  const sort = select("sort", [["name", "Name"], ["id", "ID"]], "name");
  const approvalField = field("Membership approval", approval), occupancyField = field("Household members", occupancy);
  const filters = el("fieldset", { class: "bulk-card-filters" }, grid(
    field("Card type", type), field("Sub Mahal", sub), field("House", house),
    field("Registration status", status), approvalField, occupancyField,
    field("Search records", search), field("Joined from", from), field("Joined through", to), field("Sort by", sort),
  ), el("p", { class: "muted" }, "Changing filters clears the selection. Date filters exclude records with an unknown joining date."));
  const all = button("Select all filtered", () => { rows.forEach(row => selected.add(row.id)); exports.hidden = true; drawTable(); }, "button secondary");
  const none = button("Clear selection", () => { selected.clear(); exports.hidden = true; drawTable(); }, "button secondary");
  const create = button("Prepare selected cards", prepare, "button primary");
  const stop = button("Cancel generation", () => { cancelled = true; stop.disabled = true; }, "button secondary", { hidden: true });
  function updateSummary() {
    summary.textContent = `${rows.length} matching records · ${selected.size} selected`;
    create.disabled = !selected.size || busy;
    all.disabled = !rows.length || busy; none.disabled = !selected.size || busy;
  }
  function drawTable() {
    replace(results, pagedTable(["SELECT", "NAME / ID", "HOUSE", "STATUS", "PREVIEW"], rows.map(row => {
      const checkbox = input("selected", row.id, { type: "checkbox", checked: selected.has(row.id), disabled: busy, "aria-label": `Select ${row.name} (${row.id})`, onChange: event => {
        if (event.target.checked) selected.add(row.id); else selected.delete(row.id);
        exports.hidden = true; updateSummary();
      } });
      const h = type.value === "member" ? store.state.houses.find(h => h.id === row.houseId) : row;
      return [checkbox, el("span", {}, el("strong", {}, row.name), el("small", {}, row.id)), h?.name || "—",
        badge(!row.active ? "Inactive" : type.value === "member" && !row.approved ? "Pending approval" : "Active"),
        link("Preview card", `/card/${type.value}/${row.id}`, "record-id")];
    }), 25));
    updateSummary();
  }
  function filter() {
    selected.clear(); exports.hidden = true; showError(error, "");
    approvalField.hidden = type.value !== "member"; occupancyField.hidden = type.value !== "house";
    const options = { type: type.value, subMahalId: sub.value, houseId: house.value, status: status.value, approval: approval.value, occupancy: occupancy.value, search: search.value, from: from.value, to: to.value, sort: sort.value };
    if (from.value && to.value && from.value > to.value) {
      rows = []; showError(error, new Error("Joined from must be on or before Joined through."));
    } else rows = filterCardRecords(store.state, options);
    drawTable();
  }
  function prepare() {
    const cardType = type.value;
    const parts = bulkCardParts(store.state, cardType, rows.filter(row => selected.has(row.id)).map(row => row.id));
    replace(exports, el("h2", {}, "Download your cards"), el("p", {}, `${selected.size} records · ${parts.reduce((n, part) => n + part.length, 0)} card pages · ${parts.length} PDF file${parts.length === 1 ? "" : "s"}. Each PDF contains up to 100 pages to keep large exports manageable. House continuation pages are included.`), progress, stop,
      ...parts.map((part, index) => button(`Download PDF${parts.length > 1 ? ` · part ${index + 1}` : ""} (${part.length} pages)`, () => generate(part, cardType, index + 1), "button secondary")));
    exports.hidden = false; progress.textContent = "";
  }
  async function generate(part, cardType, number) {
    if (busy) return;
    busy = true; cancelled = false; filters.disabled = true; stop.hidden = false; stop.disabled = false;
    exports.querySelectorAll("button").forEach(b => { if (b !== stop) b.disabled = true; });
    drawTable(); showError(error, "");
    const images = [];
    const cancelOnLeave = () => { cancelled = true; };
    window.addEventListener("hashchange", cancelOnLeave);
    try {
      const [{ renderCard }, { cardPdf }] = await Promise.all([import("../lib/id-card.js"), import("../lib/card-pdf.js")]);
      for (let i = 0; i < part.length; i++) {
        if (cancelled || !root.isConnected) break;
        progress.textContent = `Generating card ${i + 1} of ${part.length}…`;
        const canvas = await renderCard(part[i]);
        const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", .98));
        if (!blob) throw new Error("Unable to create the card image. Please retry.");
        images.push({ width: canvas.width, height: canvas.height, bytes: new Uint8Array(await blob.arrayBuffer()) });
        canvas.width = canvas.height = 1;
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      if (cancelled || !root.isConnected) { progress.textContent = "Generation cancelled. No partial PDF was downloaded."; return; }
      download(`mahal-${cardType}-id-cards-${number}.pdf`, cardPdf(images), "application/pdf");
      progress.textContent = `PDF ready: ${part.length} card pages downloaded.`;
    } catch (e) { showError(error, e); progress.textContent = "Generation failed. Please retry."; }
    finally {
      images.length = 0; busy = false; filters.disabled = false; stop.hidden = true;
      window.removeEventListener("hashchange", cancelOnLeave);
      exports.querySelectorAll("button").forEach(b => { b.disabled = false; });
      drawTable();
    }
  }
  filters.addEventListener("change", filter); search.addEventListener("input", filter);
  root.append(pageTitle("Bulk ID cards", "Filter your records, select members or houses, and download print-ready PDF cards."),
    el("section", { class: "panel panel-body" }, filters, el("div", { class: "form-actions" }, all, none, create), summary, error), exports, results);
  filter(); return root;
}
