import { el, link, button, empty, alertBox, showError } from "../lib/dom.js";
import { store } from "../lib/store.js";
import { cardPages } from "../domain/cards.js";
import { renderCard, pngBlob, pdfBlob } from "../lib/id-card.js";
import { download } from "../lib/browser.js";

export async function render({ type, id }) {
  let pages;
  try { pages = cardPages(store.state, type, id); }
  catch (error) { return empty(error.message); }
  const canvases = await Promise.all(pages.map(renderCard));
  const error = alertBox();
  function exportButton(label, action) {
    const control = button(label, async () => {
      control.disabled = true; showError(error, "");
      try { await action(); } catch (e) { showError(error, e); }
      finally { control.disabled = false; }
    }, "button primary");
    return control;
  }
  return el("div", { class: "standalone card-page" },
    el("div", { class: "print-toolbar" },
      link("← Members & houses", "/admin/directory", "back-link"),
      exportButton("Download PDF", async () => download(`${type}-${id}-id-card.pdf`, await pdfBlob(canvases), "application/pdf")),
      button("Print ID card", () => window.print(), "button secondary"),
    ),
    error,
    el("p", { class: "print-help" }, `${pages[0].name} · ${id}. Print at 100% scale: 85.6 × 54 mm. ${pages.length > 1 ? "All household members are included across the continuation cards; the PDF includes every page." : "Download a PNG image or a PDF below."}`),
    ...canvases.map((canvas, index) => el("section", { class: "generated-card-sheet" },
      canvas,
      el("div", { class: "print-toolbar" },
        exportButton(pages.length > 1 ? `Download PNG · page ${index + 1}` : "Download PNG", async () => download(`${type}-${id}-id-card${pages.length > 1 ? `-${index + 1}` : ""}.png`, await pngBlob(canvas), "image/png")),
      ),
    )),
  );
}
