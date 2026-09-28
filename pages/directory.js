import {
  el,
  replace,
  button,
  link,
  input,
  select,
  field,
  check,
  grid,
  form,
  dialog,
  pageTitle,
  pagedTable,
  badge,
  str,
  notify,
} from "../lib/dom.js";
import { store, run } from "../lib/store.js";
import { money, sum, outstanding, norm, displayDate } from "../domain/utils.js";
import { today } from "../lib/browser.js";
export function render() {
  let type = "member";
  const root = el("div"),
    results = el("section", { class: "panel" });
  const search = input("search", "", {
    placeholder: "Search name, ID or phone…",
    "aria-label": "Search directory",
    onInput: draw,
  });
  const sub = select(
    "sub",
    [
      ["", "All Sub Mahals"],
      ...store.state.subMahals.map((m) => [m.id, m.name]),
    ],
    "",
    { "aria-label": "Filter Sub Mahal", onChange: draw },
  );
  const members = button(
    "Members",
    () => {
      type = "member";
      draw();
    },
    "active",
  );
  const houses = button(
    "Houses",
    () => {
      type = "house";
      draw();
    },
    "",
  );
  const add = button("+ Add member", () => edit(), "button primary");
  root.append(
    pageTitle(
      "People make a Mahal.",
      "Manage members, households and their community connections.",
      [add],
    ),
    el(
      "section",
      { class: "panel toolbar" },
      el("div", { class: "tabs" }, members, houses),
      el("div", { class: "filters" }, search, sub),
    ),
    results,
  );
  const houseFor = (p) =>
    "houseId" in p ? store.state.houses.find((h) => h.id === p.houseId) : p;
  function draw() {
    const s = store.state;
    add.textContent = `+ Add ${type}`;
    members.className = type === "member" ? "active" : "";
    houses.className = type === "house" ? "active" : "";
    const rows = (type === "member" ? s.members : s.houses).filter(
      (p) =>
        norm(`${p.name} ${p.id} ${p.phone} ${p.number || ""}`).includes(
          norm(search.value),
        ) &&
        (!sub.value || houseFor(p)?.subMahalId === sub.value),
    );
    replace(
      results,
      pagedTable(
        [
          type.toUpperCase(),
          type === "member" ? "HOUSE" : "NUMBER",
          "SUB MAHAL",
          "OUTSTANDING",
          "STATUS",
          "",
        ],
        rows.map((p) => [
          button(
            el("span", {}, el("strong", {}, p.name), el("small", {}, p.id)),
            () => details(p),
            "record-button person",
          ),
          type === "member" ? houseFor(p)?.name : p.number,
          s.subMahals.find((m) => m.id === houseFor(p)?.subMahalId)?.name,
          money(
            sum(
              s.dues.filter((d) => d.payerId === p.id),
              outstanding,
            ),
          ),
          badge(
            !p.active
              ? "Inactive"
              : "approved" in p && !p.approved
                ? "Pending approval"
                : "Active",
            p.active ? "green" : "neutral",
          ),
          button("Edit", () => edit(p), "button secondary", {
            "aria-label": "Edit " + p.name,
          }),
        ]),
      ),
    );
  }
  function edit(old = {}) {
    const s = store.state,
      isMember = type === "member",
      date = today(s.settings[0].timezone);
    const modal = dialog(old.id ? `Edit ${type}` : `Add ${type}`, [], true);
    modal.body.append(
      form(
        [
          grid(
            field(
              isMember ? "Member name" : "House name",
              input("name", old.name, { required: true }),
            ),
            field("Phone", input("phone", old.phone, { type: "tel" })),
            ...(isMember
              ? [
                  field(
                    "House",
                    select(
                      "houseId",
                      [
                        ["", "Choose house"],
                        ...s.houses.map((h) => [h.id, `${h.name} · ${h.id}`]),
                      ],
                      old.houseId,
                      { required: true },
                    ),
                  ),
                  field(
                    "Date of birth",
                    input("dob", old.dob, { type: "date" }),
                  ),
                  field(
                    "Verified age (if DOB unknown)",
                    input("verifiedAge", old.verifiedAge || "", {
                      type: "number",
                      min: 0,
                    }),
                  ),
                  field(
                    "Age verified on",
                    input("ageVerifiedOn", old.ageVerifiedOn, { type: "date" }),
                  ),
                ]
              : [
                  field(
                    "House number",
                    input("number", old.number, { required: true }),
                  ),
                  field(
                    "Sub Mahal",
                    select(
                      "subMahalId",
                      s.subMahals.map((m) => [m.id, m.name]),
                      old.subMahalId,
                    ),
                  ),
                  field(
                    "Address",
                    el("textarea", { name: "address" }, old.address || ""),
                  ),
                ]),
            field(
              "Registration / joining date",
              input("joined", old.joined || date, {
                type: "date",
                required: true,
              }),
            ),
            field(
              "Move / change effective date",
              input("effectiveDate", date, { type: "date", required: true }),
            ),
            field(
              "Inactive from",
              input("inactiveDate", old.inactiveDate, { type: "date" }),
            ),
          ),
          check("Active registration", "active", old.active ?? true),
          isMember &&
            check(
              "I verify this member is a man aged 21 or above and approve membership.",
              "approved",
              old.approved || false,
            ),
          el(
            "div",
            { class: "hint-box" },
            "The permanent ID and previous receipt details are preserved.",
          ),
        ],
        "Save record",
        async (f) => {
          const value = {
            id: old.id,
            name: str(f, "name"),
            phone: str(f, "phone"),
            joined: str(f, "joined"),
            effectiveDate: str(f, "effectiveDate"),
            inactiveDate: str(f, "inactiveDate"),
            active: f.has("active"),
          };
          if (!old.id) delete value.id;
          Object.assign(
            value,
            isMember
              ? {
                  houseId: str(f, "houseId"),
                  dob: str(f, "dob"),
                  verifiedAge: Number(str(f, "verifiedAge") || 0),
                  ageVerifiedOn: str(f, "ageVerifiedOn"),
                  approved: f.has("approved"),
                }
              : {
                  number: str(f, "number"),
                  address: str(f, "address"),
                  subMahalId: str(f, "subMahalId"),
                },
          );
          await run({ type: isMember ? "saveMember" : "saveHouse", value });
          modal.close();
          draw();
          notify("Community record saved");
        },
        modal.close,
      ),
    );
  }
  function details(p) {
    const s = store.state,
      kind = "houseId" in p ? "member" : "house";
    const modal = dialog(
      "Community record",
      [
        el(
          "div",
          { class: "profile-heading" },
          el("span", { class: "avatar large" }, p.name.slice(0, 2)),
          el(
            "div",
            {},
            el("h2", {}, p.name),
            el("p", {}, `${p.id} · Joined ${displayDate(p.joined)}`),
          ),
        ),
        el(
          "p",
          {},
          `Phone: ${p.phone || "—"} · House: ${houseFor(p)?.name || "—"}`,
        ),
        el(
          "div",
          { class: "stats-grid" },
          el(
            "strong",
            {},
            `Outstanding ${money(
              sum(
                s.dues.filter((d) => d.payerId === p.id),
                outstanding,
              ),
            )}`,
          ),
        ),
        el(
          "div",
          { class: "form-actions" },
          link(
            "Receive payment",
            `/admin/receive?payer=${p.id}`,
            "button primary",
          ),
          link("Print ID card", `/card/${kind}/${p.id}`, "button secondary"),
          link("Public profile", `/p/${kind}/${p.id}`, "button secondary"),
        ),
      ],
      true,
    );
    modal.node
      .querySelectorAll("a")
      .forEach((a) => a.addEventListener("click", modal.close));
  }
  draw();
  return root;
}
