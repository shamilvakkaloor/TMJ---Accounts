import {
  el,
  replace,
  link,
  button,
  input,
  select,
  field,
  form,
  empty,
  alertBox,
  showError,
  table,
  badge,
  stat,
} from "../lib/dom.js";
import { publicDoc, publicSearch, publicList, publicHouseMembers } from "../lib/repository.js";
import { isDemo } from "../lib/firebase.js";
import { scan } from "../lib/qr.js";
import {
  money,
  sum,
  outstanding,
  dueStatus,
  displayDate,
} from "../domain/utils.js";
export const publicHeader = (name = "Mahal Accounts") =>
  el(
    "header",
    { class: "public-header" },
    link(
      el(
        "span",
        {},
        el("strong", {}, name),
        el("small", {}, "COMMUNITY PORTAL"),
      ),
      "/",
      "public-brand",
    ),
    link("Administrator →", "/admin", "button secondary"),
  );
export async function render() {
  const settings = await publicDoc("publicSettings", "mahal"),
    error = alertBox(),
    results = el("div", { class: "search-results" });
  let type = "member";
  const search = input("search", "", {
      "aria-label": "Search community records",
      placeholder: "Enter at least 2 characters",
      minLength: 2,
      required: true,
    }),
    by = select("by", [], "nameKey", { "aria-label": "Search by" });
  const member = button("Member", () => setType("member"), "active"),
    house = button("House", () => setType("house"), "");
  function setType(value) {
    type = value;
    member.className = type === "member" ? "active" : "";
    house.className = type === "house" ? "active" : "";
    replace(
      by,
      ...[
        ["nameKey", "Name"],
        ["id", "Permanent ID"],
        ...(settings?.publicPhone ? [["phoneKey", "Phone"]] : []),
        ...(type === "house" ? [["numberKey", "House number"]] : []),
      ].map(([v, label]) => el("option", { value: v }, label)),
    );
    replace(results);
  }
  const lookup = form(
    [el("div", { class: "lookup-controls" }, by, search)],
    "Find record",
    async () => {
      const records = await publicSearch(type, search.value, by.value);
      replace(
        results,
        ...(records.length
          ? records.map((r) =>
              link(
                el(
                  "span",
                  { class: "person" },
                  el("span", { class: "avatar" }, r.name.slice(0, 2)),
                  el(
                    "span",
                    {},
                    el("strong", {}, r.name),
                    el("small", {}, `${r.id} ${r.subMahalName || ""}`),
                  ),
                ),
                `/p/${type}/${r.id}`,
                "search-result",
              ),
            )
          : [
              empty(
                "No matching records",
                "Try a permanent ID or the first few letters of the name.",
              ),
            ]),
      );
      if (records.length === 20)
        results.append(
          el(
            "small",
            {},
            "First 20 matches. Type more characters to narrow your search.",
          ),
        );
    },
  );
  setType(type);
  return el(
    "div",
    { class: "public-app" },
    publicHeader(settings?.name),
    el(
      "section",
      { class: "public-hero" },
      el(
        "div",
        { class: "public-kicker" },
        el("span", { class: "live-dot" }),
        "OUR COMMUNITY, CONNECTED",
      ),
      el(
        "h1",
        {},
        "Your Mahal.",
        el("br"),
        el("em", {}, "Your contributions."),
      ),
      el(
        "p",
        {},
        "Find your community record, view contributions and keep track of your dues.",
      ),
    ),
    el(
      "main",
      { class: "lookup-main" },
      el(
        "section",
        { class: "panel lookup-panel" },
        el(
          "div",
          { class: "lookup-heading" },
          el(
            "div",
            {},
            el("h2", {}, "Find a community record"),
            el("p", {}, "Search by name, permanent ID or phone number."),
          ),
          button("Scan ID card", () => scan()),
        ),
        el("div", { class: "segmented" }, member, house),
        lookup,
        error,
        el(
          "p",
          { class: "lookup-tip" },
          "Search matches the beginning of a name, ID or number. Malayalam names are supported.",
        ),
        results,
      ),
      el(
        "div",
        { class: "public-features" },
        el(
          "div",
          {},
          el("h3", {}, "A clear contribution history"),
          el("p", {}, "See assessed dues, payments and advances in one place."),
        ),
        el(
          "div",
          {},
          el("h3", {}, "One scan, one record"),
          el("p", {}, "Your ID card opens your current community profile."),
        ),
        el(
          "div",
          {},
          el("h3", {}, "Always part of your Mahal"),
          el("p", {}, "Your member ID stays with you when you change houses."),
        ),
      ),
    ),
    el(
      "footer",
      { class: "public-footer" },
      `${settings?.name || "Mahal Accounts"} · ${settings?.contact || "Contact your Mahal administrator for corrections."}`,
      isDemo && el("span", {}, "Fictional demo records"),
    ),
  );
}
export async function profile({ type, id }) {
  const [record, settings] = await Promise.all([
    publicDoc(type === "member" ? "publicMembers" : "publicHouses", id),
    publicDoc("publicSettings", "mahal"),
  ]);
  const root = el("div", { class: "public-app" }, publicHeader(settings?.name)),
    main = el(
      "main",
      { class: "public-profile" },
      link("← Back to search", "/", "back-link"),
    );
  root.append(main);
  if (!record) {
    main.append(
      empty("Record unavailable", "Check the ID or contact the administrator."),
    );
    return root;
  }
  const house =
    type === "member"
      ? await publicDoc("publicHouses", record.houseId)
      : record;
  main.append(
    el(
      "section",
      { class: "panel profile-card" },
      el(
        "div",
        { class: "profile-heading" },
        el("div", { class: "avatar large" }, record.name.slice(0, 2)),
        el(
          "div",
          {},
          el("div", { class: "eyebrow" }, `${type.toUpperCase()} RECORD`),
          el("h1", {}, record.name),
          el("span", {}, `${id} · ${house?.subMahalName || ""}`),
        ),
        badge(
          record.active ? "Active" : "Inactive",
          record.active ? "green" : "neutral",
        ),
      ),
      el(
        "div",
        { class: "detail-grid" },
        el(
          "div",
          {},
          el("span", {}, "House"),
          el("strong", {}, `${house?.name || "—"} · ${house?.number || ""}`),
        ),
        settings.publicPhone &&
          el(
            "div",
            {},
            el("span", {}, "Phone"),
            el("strong", {}, record.phone || "—"),
          ),
        settings.publicAddress &&
          el(
            "div",
            {},
            el("span", {}, "Address"),
            el("strong", {}, house?.address || "—"),
          ),
      ),
    ),
  );
  if (type === "member" && house) main.append(link("View all members in this house", `/p/house/${house.id}`, "button secondary"));
  if (type === "house") {
    const people = [], list = el("div"), issue = alertBox();
    const moreMembers = button("Load more members", fetchMembers, "button secondary");
    const heading = el("h2", {}, "House members");
    async function fetchMembers() {
      moreMembers.disabled = true; showError(issue, "");
      try {
        const page = await publicHouseMembers(id, people.at(-1)?.id);
        people.push(...page);
        heading.textContent = `House members (${people.length}${page.length === 100 ? "+" : ""})`;
        replace(list, people.length ? table(["MEMBER", "ID", "STATUS"], people.map((member) => [
          link(member.name, `/p/member/${member.id}`, "record-id"), member.id,
          badge(member.active ? "Active" : "Inactive", member.active ? "green" : "neutral"),
        ])) : empty("No members registered in this house"));
        moreMembers.hidden = page.length < 100;
      } catch (e) { showError(issue, e); }
      finally { moreMembers.disabled = false; }
    }
    main.append(el("section", { class: "panel panel-body house-members" }, heading, list, issue, moreMembers));
    await fetchMembers();
  }
  if (!settings.publicHistory) {
    main.append(
      el(
        "div",
        { class: "hint-box" },
        "Financial history is private. Contact the administrator for your statement.",
      ),
    );
    return root;
  }
  let dues = [],
    receipts = [],
    credits = [],
    more = true;
  const totals = el("div", { class: "stats-grid" }),
    tables = el("div"),
    error = alertBox(),
    load = button("Load more history", fetchMore);
  async function fetchMore() {
    load.disabled = true;
    try {
      const [d, r, c] = await Promise.all([
        publicList("publicDues", id, dues.at(-1)?.id),
        publicList("publicReceipts", id, receipts.at(-1)?.id),
        publicList("publicCredits", id, credits.at(-1)?.id),
      ]);
      dues.push(...d);
      receipts.push(...r);
      credits.push(...c);
      more = d.length === 100 || r.length === 100 || c.length === 100;
      load.hidden = !more;
      replace(
        totals,
        stat(
          "Outstanding",
          money(sum(dues, outstanding)),
          more
            ? "Loaded history only; load more for all records"
            : "All assessed dues",
        ),
        stat(
          "Advance balance",
          money(sum(credits, (c) => c.amount)),
          more ? "Loaded history only" : "Available linked advances",
        ),
      );
      replace(
        tables,
        el(
          "section",
          { class: "panel" },
          el(
            "div",
            { class: "panel-heading" },
            el("h2", {}, "Dues & contributions"),
          ),
          table(
            [
              "FUND / PERIOD",
              "ASSESSED",
              "PAID",
              "WAIVED",
              "BALANCE",
              "STATUS",
            ],
            dues.map((d) => [
              `${d.fundTitle} · ${d.period}`,
              money(d.assessed),
              money(d.paid),
              money(d.waived),
              money(outstanding(d)),
              badge(dueStatus(d)),
            ]),
          ),
        ),
        el(
          "section",
          { class: "panel" },
          el("div", { class: "panel-heading" }, el("h2", {}, "Receipts")),
          table(
            ["RECEIPT", "DATE", "AMOUNT", "STATUS"],
            receipts.map((r) => [
              link(r.number, `/receipt/${r.id}`, "record-id"),
              displayDate(r.date),
              money(r.total),
              badge(
                r.voided
                  ? "Voided"
                  : r.refunded
                    ? "Refunded / adjusted"
                    : "Valid",
                r.voided ? "gold" : "green",
              ),
            ]),
          ),
        ),
      );
    } catch (e) {
      showError(error, e);
    } finally {
      load.disabled = false;
    }
  }
  main.append(totals, tables, error, load);
  await fetchMore();
  return root;
}
export async function card(info) {
  return (await import('./cards.js')).render(info);
}
