/** Small DOM helpers: no JSX, template evaluation, virtual DOM or framework. */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key.startsWith("on") && typeof value === "function")
      node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === "class") node.className = value;
    else if (key === "dataset") Object.assign(node.dataset, value);
    else if (["value", "checked", "disabled", "selected"].includes(key))
      node[key] = value;
    else node.setAttribute(key, value === true ? "" : value);
  }
  for (const child of children.flat(Infinity)) {
    if (child === false || child === null || child === undefined) continue;
    node.append(
      child instanceof Node ? child : document.createTextNode(String(child)),
    );
  }
  return node;
}
export const link = (text, route, className = "text-link") =>
  el("a", { href: "#" + route, class: className }, text);
export const button = (
  text,
  onClick,
  className = "button secondary",
  attrs = {},
) =>
  el("button", { type: "button", class: className, onClick, ...attrs }, text);
export const input = (name, value = "", attrs = {}) =>
  el("input", { name, value, ...attrs });
let fieldSequence = 0;
export function field(label, control, hint = "") {
  const id = `field-${++fieldSequence}`;
  control.setAttribute("aria-labelledby", id);
  if (hint) control.setAttribute("aria-describedby", id + "-hint");
  return el(
    "label",
    { class: "field" },
    el("span", { id }, label),
    control,
    hint && el("small", { id: id + "-hint" }, hint),
  );
}
export function replace(node, ...children) {
  node.replaceChildren(
    ...children
      .flat(Infinity)
      .filter(
        (child) => child !== false && child !== null && child !== undefined,
      ),
  );
}
export const select = (name, choices, value = "", attrs = {}) =>
  el(
    "select",
    { name, ...attrs },
    choices.map((choice) => {
      const [v, label] = Array.isArray(choice) ? choice : [choice, choice];
      return el(
        "option",
        { value: v, selected: String(v) === String(value) },
        label,
      );
    }),
  );
export const check = (label, name, checked = false) =>
  el(
    "label",
    { class: "check-field" },
    input(name, "true", { type: "checkbox", checked }),
    el("span", {}, label),
  );
export const grid = (...children) =>
  el("div", { class: "form-grid" }, children);
export const badge = (text, tone = "neutral") =>
  el("span", { class: `badge ${tone}` }, text);
export const empty = (title, text = "") =>
  el(
    "div",
    { class: "empty" },
    el("div", { class: "empty-icon" }, "◇"),
    el("h3", {}, title),
    el("p", {}, text),
  );
export const pageTitle = (title, description = "", actions = []) =>
  el(
    "div",
    { class: "page-heading" },
    el(
      "div",
      {},
      el("div", { class: "eyebrow" }, "COMMUNITY ACCOUNTS"),
      el("h1", {}, title),
      el("p", {}, description),
    ),
    el("div", { class: "heading-action" }, actions),
  );
export const stat = (label, value, detail = "", featured = false) =>
  el(
    "div",
    { class: "stat " + (featured ? "featured" : "") },
    el("div", { class: "stat-top" }, label),
    el("strong", {}, value),
    el("small", { class: "stat-detail" }, detail),
  );
export const alertBox = () =>
  el("div", { role: "alert", class: "alert danger", hidden: true });
export function showError(node, error) {
  node.hidden = !error;
  node.textContent = error?.message || String(error || "");
}
export const str = (data, name) => String(data.get(name) || "").trim();
export const table = (headers, rows) =>
  el(
    "div",
    { class: "table-wrap" },
    el(
      "table",
      {},
      el(
        "thead",
        {},
        el(
          "tr",
          {},
          headers.map((h) => el("th", {}, h)),
        ),
      ),
      el(
        "tbody",
        {},
        rows.map((row) =>
          el(
            "tr",
            {},
            row.map((cell) => el("td", {}, cell)),
          ),
        ),
      ),
    ),
  );
export function notify(message) {
  document.getElementById("toast")?.remove();
  const toast = el(
    "div",
    { id: "toast", class: "toast", role: "status" },
    message,
  );
  document.body.append(toast);
  setTimeout(() => toast.remove(), 5000);
}
export function dialog(title, content, wide = false) {
  const previous = document.activeElement,
    body = el("div", { class: "modal-body" }, content);
  const node = el(
    "dialog",
    { class: "native-dialog " + (wide ? "wide" : ""), "aria-label": title },
    el(
      "div",
      { class: "modal-header" },
      el("h2", {}, title),
      button("×", () => node.close(), "icon-button", {
        "aria-label": "Close dialog",
      }),
    ),
    body,
  );
  node.addEventListener("close", () => {
    node.remove();
    previous?.focus();
  });
  document.body.append(node);
  node.showModal();
  return { node, body, close: () => node.close() };
}
export function form(content, submit, onSubmit, cancel) {
  const error = alertBox(),
    submitButton = el(
      "button",
      { type: "submit", class: "button primary" },
      submit,
    );
  const node = el(
    "form",
    {},
    content,
    error,
    el(
      "div",
      { class: "form-actions" },
      cancel && button("Cancel", cancel),
      submitButton,
    ),
  );
  let busy = false;
  node.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy) return;
    busy = true;
    submitButton.disabled = true;
    showError(error, "");
    try {
      await onSubmit(new FormData(node), node);
    } catch (e) {
      showError(error, e);
    } finally {
      busy = false;
      submitButton.disabled = false;
    }
  });
  return node;
}
export function pagedTable(headers, rows, pageSize = 10) {
  const node = el("div"),
    controls = el("div", { class: "pagination" });
  let page = 1;
  function draw() {
    const pages = Math.max(1, Math.ceil(rows.length / pageSize));
    page = Math.min(page, pages);
    controls.replaceChildren(
      el("span", {}, `${rows.length} records · Page ${page} of ${pages}`),
      button(
        "Previous",
        () => {
          page--;
          draw();
        },
        "button secondary",
        { disabled: page <= 1 },
      ),
      button(
        "Next",
        () => {
          page++;
          draw();
        },
        "button secondary",
        { disabled: page >= pages },
      ),
    );
    node.replaceChildren(
      rows.length
        ? table(headers, rows.slice((page - 1) * pageSize, page * pageSize))
        : empty("No records yet"),
      controls,
    );
  }
  draw();
  return node;
}
