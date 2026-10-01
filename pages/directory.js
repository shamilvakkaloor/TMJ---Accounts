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
import { money, sum, outstanding, displayDate } from "../domain/utils.js";
import { today } from "../lib/browser.js";
import { houseMembers } from "../domain/cards.js";
import { directoryRows, removalPlan } from "../domain/directory.js";
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
  const status = select(
    "status",
    [
      ["", "All statuses"],
      ["active", "Active"],
      ["inactive", "Inactive"],
    ],
    "",
    { "aria-label": "Filter status", onChange: draw },
  );
  const houseFilter = select(
    "house",
    [
      ["", "All houses"],
      ...store.state.houses.map((h) => [h.id, `${h.name} · ${h.id}`]),
    ],
    "",
    { "aria-label": "Filter house", onChange: draw },
  );
  const occupancy = select(
    "occupancy",
    [
      ["", "All households"],
      ["empty", "Without members"],
      ["occupied", "With members"],
    ],
    "",
    { "aria-label": "Filter household members", onChange: draw },
  );
  let filtered = [];
  const removeFiltered = button("Delete filtered records", () =>
    reviewRemoval(
      type,
      filtered.map((p) => p.id),
    ),
  );
  const filterSummary = el("p", { class: "muted", "aria-live": "polite" });
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
      el(
        "div",
        { class: "filters" },
        search,
        sub,
        status,
        houseFilter,
        occupancy,
      ),
    ),
    el(
      "div",
      { class: "directory-cleanup-bar" },
      filterSummary,
      removeFiltered,
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
    houseFilter.hidden = type !== "member";
    const selectedHouse = houseFilter.value;
    replace(
      houseFilter,
      el("option", { value: "" }, "All houses"),
      s.houses.map((h) => el("option", { value: h.id }, `${h.name} · ${h.id}`)),
    );
    houseFilter.value = s.houses.some((h) => h.id === selectedHouse)
      ? selectedHouse
      : "";
    occupancy.hidden = type !== "house";
    const rows = directoryRows(s, type, {
      search: search.value,
      sub: sub.value,
      status: status.value,
      house: type === "member" ? houseFilter.value : "",
      occupancy: type === "house" ? occupancy.value : "",
    });
    filtered = rows;
    removeFiltered.disabled = rows.length === 0;
    removeFiltered.textContent = `Delete filtered ${type === "member" ? "members" : "houses"} (${rows.length})`;
    filterSummary.textContent = `${rows.length} matching ${type === "member" ? "members" : "houses"} across all pages.${type === "house" ? " Houses can be registered without members, including women-only households." : " Member dues and advances stay with the member when they move."}`;
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
          el(
            "div",
            { class: "directory-actions" },
            button("Edit", () => edit(p), "button secondary", {
              "aria-label": "Edit " + p.name,
            }),
            link("ID card", `/card/${type}/${p.id}`, "button secondary"),
            type === "house" &&
              button("View members", () => details(p), "button secondary"),
            type === "member" &&
              button("Transfer", () => transfer(p), "button secondary", {
                "aria-label": "Transfer " + p.name,
              }),
            button(
              "Delete",
              () => reviewRemoval(type, [p.id]),
              "button secondary",
              { "aria-label": "Delete " + p.name },
            ),
          ),
        ]),
      ),
    );
  }
  function reviewRemoval(kind, ids) {
    const plan = removalPlan(store.state, kind, ids);
    const deletions = plan.filter((p) => p.action === "delete").length;
    const archives = plan.filter((p) => p.action === "archive").length;
    const pending = plan.filter((p) =>
      ["delete", "archive"].includes(p.action),
    );
    const modal = dialog("Review record removal", [], true);
    modal.node.classList.add("record-removal-dialog");
    const progress = el("p", { role: "status", class: "muted" });
    const done = new Set();
    let working = false;
    modal.node.addEventListener("cancel", (event) => {
      if (working) event.preventDefault();
    });
    modal.body.append(
      el(
        "p",
        { class: "hint-box" },
        `${ids.length} ${kind} records selected across all pages: ${deletions} permanently deleted, ${archives} made inactive, ${plan.length - pending.length} retained unchanged. No payments or dues will be deleted. House removal does not remove its members.`,
      ),
      el(
        "div",
        { class: "removal-preview" },
        pagedTable(
          ["RECORD", "ID", "ACTION", "REASON"],
          plan.map((p) => [
            p.record?.name || "—",
            p.id,
            {
              delete: "Delete permanently",
              archive: "Make inactive",
              keep: "Keep inactive",
              missing: "Missing",
            }[p.action],
            p.reason,
          ]),
        ),
      ),
      progress,
    );
    if (!pending.length) return;
    modal.body.append(
      form(
        [
          field(
            "Reason for removal",
            input("reason", "", {
              required: true,
              minLength: 3,
              maxLength: 300,
            }),
          ),
          field(
            "Type REMOVE to confirm",
            input("confirmation", "", {
              required: true,
              pattern: "REMOVE",
              autoComplete: "off",
            }),
            "Permanent deletion cannot be undone. Inactive records and their history remain available.",
          ),
        ],
        "Confirm removal",
        async (data) => {
          if (str(data, "confirmation") !== "REMOVE")
            throw new Error("Type REMOVE to confirm.");
          working = true;
          const buttonStates = [...modal.node.querySelectorAll("button")].map(
            (b) => [b, b.disabled],
          );
          modal.node
            .querySelectorAll("button")
            .forEach((b) => (b.disabled = true));
          try {
            const remaining = pending.filter((p) => !done.has(p.id));
            for (let i = 0; i < remaining.length; i += 5) {
              const group = remaining.slice(i, i + 5);
              progress.textContent = `Processing ${done.size + 1}–${done.size + group.length} of ${pending.length}…`;
              await run({
                type: "removeRecords",
                recordType: kind,
                ids: group.map((p) => p.id),
                plan: group.map((p) => [p.id, p.action]),
                reason: str(data, "reason"),
              });
              group.forEach((p) => done.add(p.id));
            }
            modal.close();
            notify(`${deletions} deleted; ${archives} made inactive.`);
          } catch (error) {
            throw new Error(
              `${done.size} of ${pending.length} records completed. ${error.message}`,
            );
          } finally {
            working = false;
            buttonStates.forEach(([b, disabled]) => (b.disabled = disabled));
            draw();
          }
        },
        modal.close,
      ),
    );
  }
  function transfer(member) {
    const s = store.state,
      current = s.houses.find((h) => h.id === member.houseId);
    const modal = dialog("Transfer member", [], true);
    modal.node.classList.add("member-transfer-dialog");
    const subFilter = select(
      "destinationSub",
      [["", "All Sub Mahals"], ...s.subMahals.map((m) => [m.id, m.name])],
      "",
    );
    const destination = select("houseId", [], "", { required: true });
    function destinations() {
      replace(
        destination,
        el("option", { value: "" }, "Choose destination house"),
        s.houses
          .filter(
            (h) =>
              h.active &&
              h.id !== member.houseId &&
              (!subFilter.value || h.subMahalId === subFilter.value),
          )
          .map((h) =>
            el(
              "option",
              { value: h.id },
              `${h.name} · ${h.id} · ${s.subMahals.find((m) => m.id === h.subMahalId)?.name || ""}`,
            ),
          ),
      );
    }
    subFilter.addEventListener("change", destinations);
    destinations();
    modal.body.append(
      el(
        "p",
        { class: "hint-box" },
        `${member.name} (${member.id}) · Current house: ${current?.name || member.houseId}. All member dues and advance balances stay with this member. House dues stay with their house; past receipts keep their original details.`,
      ),
      form(
        [
          field("Destination Sub Mahal", subFilter),
          field("Destination house", destination),
          field(
            "Move effective date",
            input("date", today(s.settings[0].timezone), {
              type: "date",
              required: true,
              min: member.houseHistory.at(-1).date,
              max: today(s.settings[0].timezone),
            }),
          ),
        ],
        "Transfer member",
        async (data) => {
          await run({
            type: "transferMember",
            id: member.id,
            fromHouseId: member.houseId,
            houseId: str(data, "houseId"),
            date: str(data, "date"),
          });
          modal.close();
          draw();
          notify("Member transferred. Dues and advances retained.");
        },
        modal.close,
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
                    "Care of (optional)",
                    input("careOf", old.careOf || ""),
                  ),
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
              input("joined", old.joined || (isMember ? "" : date), {
                type: "date",
                required: !isMember,
              }),
              isMember
                ? "Optional for pending members. Leave blank when unknown; add it before approving membership."
                : "",
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
            isMember
              ? "Member dues and advances follow the permanent member ID. Moving houses preserves previous receipt details."
              : "A house can be registered without members, including a women-only household.",
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
                  careOf: str(f, "careOf"),
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
        kind === "member" && el("p", {}, `Care of: ${p.careOf || "—"}`),
        kind === "member" &&
          el(
            "section",
            { class: "house-members" },
            el("h3", {}, "House history"),
            pagedTable(
              ["EFFECTIVE FROM", "HOUSE", "ID"],
              p.houseHistory.map((h) => [
                displayDate(h.date),
                s.houses.find((v) => v.id === h.value)?.name || "—",
                h.value,
              ]),
            ),
          ),
        kind === "house" &&
          el(
            "section",
            { class: "house-members" },
            el("h3", {}, `House members (${houseMembers(s, p.id).length})`),
            houseMembers(s, p.id).length
              ? pagedTable(
                  ["MEMBER", "ID", "STATUS", ""],
                  houseMembers(s, p.id).map((member) => [
                    button(
                      member.name,
                      () => {
                        modal.close();
                        details(member);
                      },
                      "record-button",
                    ),
                    member.id,
                    badge(
                      !member.active
                        ? "Inactive"
                        : member.approved
                          ? "Active"
                          : "Pending approval",
                    ),
                    link(
                      "ID card",
                      `/card/member/${member.id}`,
                      "button secondary",
                    ),
                  ]),
                )
              : el("p", {}, "No members registered in this house."),
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
          link("Generate ID card", `/card/${kind}/${p.id}`, "button secondary"),
          link("Public profile", `/p/${kind}/${p.id}`, "button secondary"),
          kind === "member" &&
            button("Transfer member", () => {
              modal.close();
              transfer(p);
            }),
          button("Delete record", () => {
            modal.close();
            reviewRemoval(kind, [p.id]);
          }),
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
