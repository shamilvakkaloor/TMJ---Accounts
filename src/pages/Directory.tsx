import { useEffect, useState } from "react";
import { ArrowUpRight, Building2, Pencil, Plus, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { useApp } from "../data/context";
import { appUrl } from "../data/urls";
import type { House, Member } from "../domain/types";
import {
  displayDate,
  money,
  norm,
  outstanding,
  sum,
  today,
} from "../domain/utils";
import {
  AsyncForm,
  Badge,
  Dialog,
  Empty,
  Field,
  PageTitle,
  Pagination,
  SearchBox,
  str,
} from "../ui/components";
export function Directory() {
  const { state: s, run, notify } = useApp();
  const [tab, setTab] = useState<"member" | "house">("member"),
    [search, setSearch] = useState(""),
    [sub, setSub] = useState(""),
    [page, setPage] = useState(1),
    [edit, setEdit] = useState<Member | House | "new" | null>(null),
    [selected, setSelected] = useState<Member | House | null>(null);
  useEffect(() => setPage(1), [search, sub, tab]);
  const houseFor = (p: Member | House) =>
    "houseId" in p ? s.houses.find((h) => h.id === p.houseId) : p;
  const records = (tab === "member" ? s.members : s.houses).filter(
    (p) =>
      norm(
        p.name +
          " " +
          p.id +
          " " +
          p.phone +
          ("number" in p ? " " + p.number : ""),
      ).includes(norm(search)) &&
      (!sub || houseFor(p)?.subMahalId === sub),
  );
  return (
    <>
      <PageTitle
        title="People make a Mahal."
        description="Manage your members, households and their community connections."
        action={
          <button className="button primary" onClick={() => setEdit("new")}>
            <Plus size={17} />
            Add {tab}
          </button>
        }
      />
      <div className="directory-summary">
        <div>
          <Users />
          <strong>{s.members.length}</strong>
          <span>registered members</span>
        </div>
        <div>
          <Building2 />
          <strong>{s.houses.length}</strong>
          <span>registered houses</span>
        </div>
        <div>
          <span className="color-dot" />
          <strong>{s.subMahals.length}</strong>
          <span>connected Sub Mahals</span>
        </div>
      </div>
      <section className="panel">
        <div className="toolbar">
          <div className="tabs">
            <button
              className={tab === "member" ? "active" : ""}
              onClick={() => setTab("member")}
            >
              Members <span>{s.members.length}</span>
            </button>
            <button
              className={tab === "house" ? "active" : ""}
              onClick={() => setTab("house")}
            >
              Houses <span>{s.houses.length}</span>
            </button>
          </div>
          <div className="filters">
            <SearchBox
              value={search}
              onChange={setSearch}
              placeholder="Search name, ID or phone…"
            />
            <select
              aria-label="Filter Sub Mahal"
              value={sub}
              onChange={(e) => setSub(e.target.value)}
            >
              <option value="">All Sub Mahals</option>
              {s.subMahals.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{tab === "member" ? "MEMBER" : "HOUSE"}</th>
                <th>{tab === "member" ? "HOUSE" : "HOUSE NUMBER"}</th>
                <th>SUB MAHAL</th>
                <th>OUTSTANDING</th>
                <th>STATUS</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {records.slice((page - 1) * 10, page * 10).map((p) => {
                const h = houseFor(p);
                return (
                  <tr key={p.id}>
                    <td>
                      <button
                        className="person record-button"
                        onClick={() => setSelected(p)}
                      >
                        <span className="avatar">
                          {p.name.slice(0, 2).toUpperCase()}
                        </span>
                        <span>
                          <strong>{p.name}</strong>
                          <small>{p.id}</small>
                        </span>
                      </button>
                    </td>
                    <td>{tab === "member" ? h?.name : h?.number}</td>
                    <td>
                      {s.subMahals.find((m) => m.id === h?.subMahalId)?.name}
                    </td>
                    <td className="amount">
                      {money(
                        sum(
                          s.dues.filter((d) => d.payerId === p.id),
                          outstanding,
                        ),
                      )}
                    </td>
                    <td>
                      <Badge tone={p.active ? "green" : "neutral"}>
                        {p.active
                          ? "approved" in p && !p.approved
                            ? "Pending approval"
                            : "Active"
                          : "Inactive"}
                      </Badge>
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={"Edit " + p.name}
                        onClick={() => setEdit(p)}
                      >
                        <Pencil size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!records.length && (
          <Empty
            title={`No ${tab === "member" ? "members" : "houses"} found`}
            text="Add a record or try a different search."
          />
        )}
        <Pagination page={page} setPage={setPage} total={records.length} />
      </section>
      {edit && (
        <Dialog
          title={`${edit === "new" ? "Register" : "Edit"} ${tab}`}
          onClose={() => setEdit(null)}
          wide
        >
          <AsyncForm
            onCancel={() => setEdit(null)}
            submit={edit === "new" ? `Register ${tab}` : "Save changes"}
            onSubmit={async (f) => {
              const active = f.has("active");
              const common = {
                id: edit === "new" ? undefined : edit.id,
                name: str(f, "name"),
                phone: str(f, "phone"),
                active,
                joined: str(f, "joined"),
                inactiveDate: active ? "" : str(f, "inactiveDate"),
                effectiveDate: str(f, "effectiveDate"),
              };
              if (tab === "member")
                await run({
                  type: "saveMember",
                  value: {
                    ...common,
                    dob: str(f, "dob"),
                    verifiedAge: Number(str(f, "verifiedAge")),
                    ageVerifiedOn: str(f, "ageVerifiedOn"),
                    houseId: str(f, "houseId"),
                    approved: f.has("approved"),
                  },
                });
              else
                await run({
                  type: "saveHouse",
                  value: {
                    ...common,
                    number: str(f, "number"),
                    address: str(f, "address"),
                    subMahalId: str(f, "subMahalId"),
                  },
                });
              notify(`${tab === "member" ? "Member" : "House"} saved`);
              setEdit(null);
            }}
          >
            <div className="form-grid">
              <Field label={tab === "member" ? "Full name" : "House name"}>
                <input
                  name="name"
                  required
                  defaultValue={edit === "new" ? "" : edit.name}
                />
              </Field>
              <Field label="Phone number">
                <input
                  name="phone"
                  type="tel"
                  defaultValue={edit === "new" ? "" : edit.phone}
                />
              </Field>
              {tab === "member" ? (
                <>
                  <Field label="House">
                    <select
                      name="houseId"
                      required
                      defaultValue={
                        edit !== "new" && "houseId" in edit ? edit.houseId : ""
                      }
                    >
                      <option value="">Choose a house</option>
                      {s.houses.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.id} · {h.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field
                    label="Date of birth"
                    hint="Or enter verified age below."
                  >
                    <input
                      name="dob"
                      type="date"
                      defaultValue={
                        edit !== "new" && "dob" in edit ? edit.dob : ""
                      }
                    />
                  </Field>
                  <Field label="Verified age">
                    <input
                      name="verifiedAge"
                      type="number"
                      min="21"
                      max="130"
                      defaultValue={
                        edit !== "new" && "verifiedAge" in edit
                          ? edit.verifiedAge || ""
                          : ""
                      }
                    />
                  </Field>
                  <Field label="Age verification date">
                    <input
                      name="ageVerifiedOn"
                      type="date"
                      defaultValue={
                        edit !== "new" && "ageVerifiedOn" in edit
                          ? edit.ageVerifiedOn
                          : today()
                      }
                    />
                  </Field>
                </>
              ) : (
                <>
                  <Field label="House number">
                    <input
                      name="number"
                      required
                      defaultValue={
                        edit !== "new" && "number" in edit ? edit.number : ""
                      }
                    />
                  </Field>
                  <Field label="Sub Mahal">
                    <select
                      name="subMahalId"
                      defaultValue={
                        edit !== "new" && "subMahalId" in edit
                          ? edit.subMahalId
                          : ""
                      }
                      required
                    >
                      <option value="">Choose a Sub Mahal</option>
                      {s.subMahals.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Address">
                    <textarea
                      name="address"
                      defaultValue={
                        edit !== "new" && "address" in edit ? edit.address : ""
                      }
                    />
                  </Field>
                </>
              )}
              <Field label="Registration / joining date">
                <input
                  type="date"
                  name="joined"
                  required
                  defaultValue={edit === "new" ? today() : edit.joined}
                />
              </Field>
              <Field label="Move / change effective date">
                <input
                  type="date"
                  name="effectiveDate"
                  required
                  defaultValue={today()}
                />
              </Field>
              <Field
                label="Inactive from"
                hint="Required only when marking inactive."
              >
                <input
                  type="date"
                  name="inactiveDate"
                  defaultValue={edit === "new" ? "" : edit.inactiveDate}
                />
              </Field>
            </div>
            <label className="check">
              <input
                name="active"
                type="checkbox"
                defaultChecked={edit === "new" || edit.active}
              />
              Active registration
            </label>
            {tab === "member" && (
              <label className="check">
                <input
                  name="approved"
                  type="checkbox"
                  defaultChecked={
                    edit !== "new" && "approved" in edit && edit.approved
                  }
                />
                I verify this member is a man aged 21 or above and approve
                membership.
              </label>
            )}
            <div className="hint-box">
              Changes preserve the permanent ID and earlier receipt details.
              Existing dues remain on the original payer.
            </div>
          </AsyncForm>
        </Dialog>
      )}
      {selected && (
        <Dialog title="Community record" onClose={() => setSelected(null)} wide>
          <div className="profile-heading">
            <div className="avatar large">{selected.name.slice(0, 2)}</div>
            <div>
              <h2>{selected.name}</h2>
              <span>
                {selected.id} · Joined {displayDate(selected.joined)}
              </span>
            </div>
            <QRCodeSVG
              value={appUrl(
                `/p/${"houseId" in selected ? "member" : "house"}/${selected.id}`,
              )}
              size={84}
            />
          </div>
          <div className="detail-grid">
            <div>
              <span>House</span>
              <strong>{houseFor(selected)?.name}</strong>
            </div>
            <div>
              <span>Phone</span>
              <strong>{selected.phone || "—"}</strong>
            </div>
            <div>
              <span>Outstanding</span>
              <strong>
                {money(
                  sum(
                    s.dues.filter((d) => d.payerId === selected.id),
                    outstanding,
                  ),
                )}
              </strong>
            </div>
            <div>
              <span>Advance credit</span>
              <strong>
                {money(
                  sum(
                    s.credits.filter((c) => c.payerId === selected.id),
                    (c) => c.amount,
                  ),
                )}
              </strong>
            </div>
          </div>
          <h3>Assignment history</h3>
          <div className="timeline">
            {("houseHistory" in selected
              ? selected.houseHistory
              : selected.subHistory
            ).map((h) => (
              <div key={h.date}>
                <span>{displayDate(h.date)}</span>
                <strong>
                  {s.houses.find((x) => x.id === h.value)?.name ||
                    s.subMahals.find((x) => x.id === h.value)?.name ||
                    h.value}
                </strong>
              </div>
            ))}
          </div>
          <div className="form-actions">
            <Link
              className="button secondary"
              to={`/p/${"houseId" in selected ? "member" : "house"}/${selected.id}`}
            >
              Public profile <ArrowUpRight size={15} />
            </Link>
            <Link
              className="button secondary"
              to={`/card/${"houseId" in selected ? "member" : "house"}/${selected.id}`}
            >
              Print ID card
            </Link>
            <Link
              className="button primary"
              to={"/admin/receive?payer=" + selected.id}
            >
              Receive payment
            </Link>
          </div>
        </Dialog>
      )}
    </>
  );
}
