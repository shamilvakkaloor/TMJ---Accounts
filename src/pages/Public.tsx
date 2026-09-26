import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Home,
  QrCode,
  Search,
  ShieldCheck,
  Printer,
} from "lucide-react";
import type { IScannerControls } from "@zxing/browser";
import { QRCodeSVG } from "qrcode.react";
import type { DocumentData } from "firebase/firestore";
import { publicDoc, publicList, publicSearch } from "../data/repository";
import { isDemo } from "../data/firebase";
import { appUrl, scannedRecordRoute } from "../data/urls";
import { dueStatus, money, outstanding, sum } from "../domain/utils";
import type { Due } from "../domain/types";
import { Badge, Dialog, Empty, ErrorBox, Field } from "../ui/components";
function PublicHeader({ name = "Mahal" }: { name?: string }) {
  return (
    <header className="public-header">
      <Link className="public-brand" to="/">
        <div className="brand-mark">
          <Home size={23} />
        </div>
        <strong>
          {name}
          <small>COMMUNITY PORTAL</small>
        </strong>
      </Link>
      <Link className="button secondary" to="/admin">
        Administrator <ArrowRight size={15} />
      </Link>
    </header>
  );
}
export function PublicHome() {
  const [settings, setSettings] = useState<DocumentData | null>(null),
    [type, setType] = useState<"member" | "house">("member"),
    [field, setField] = useState("nameKey"),
    [input, setInput] = useState(""),
    [results, setResults] = useState<DocumentData[]>([]),
    [searched, setSearched] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [scan, setScan] = useState(false);
  useEffect(() => {
    publicDoc("publicSettings", "mahal")
      .then(setSettings)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <div className="public-app">
      <PublicHeader name={settings?.name} />
      <section className="public-hero">
        <div className="public-kicker">
          <span className="live-dot" />
          OUR COMMUNITY, CONNECTED
        </div>
        <h1>
          Your Mahal.
          <br />
          <em>Your contributions.</em>
        </h1>
        <p>
          Find your member or house record, view contributions
          <br className="desktop-only" /> and keep track of your community dues.
        </p>
        <div className="hero-pattern" aria-hidden="true">
          <Home size={220} strokeWidth={0.5} />
        </div>
      </section>
      <main className="lookup-main">
        <section className="panel lookup-panel">
          <div className="lookup-heading">
            <div>
              <h2>Find a community record</h2>
              <p>Search by name, permanent ID or phone number.</p>
            </div>
            <button className="button secondary" onClick={() => setScan(true)}>
              <QrCode size={17} />
              Scan ID card
            </button>
          </div>
          <div className="segmented">
            <button
              className={type === "member" ? "active" : ""}
              onClick={() => {
                setType("member");
                setResults([]);
                setSearched(false);
              }}
            >
              Member
            </button>
            <button
              className={type === "house" ? "active" : ""}
              onClick={() => {
                setType("house");
                setResults([]);
                setSearched(false);
              }}
            >
              House
            </button>
          </div>
          <form
            className="lookup-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                setResults(await publicSearch(type, input, field));
                setSearched(true);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <select
              aria-label="Search by"
              value={field}
              onChange={(e) => setField(e.target.value)}
            >
              <option value="nameKey">Name</option>
              <option value="id">Permanent ID</option>
              {settings?.publicPhone && <option value="phoneKey">Phone</option>}
              {type === "house" && (
                <option value="numberKey">House number</option>
              )}
            </select>
            <div className="search-input">
              <Search size={18} />
              <input
                aria-label="Search community records"
                minLength={2}
                required
                placeholder={
                  field === "id"
                    ? "e.g. M-000001"
                    : "Enter at least 2 characters"
                }
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
            </div>
            <button className="button primary" disabled={busy}>
              {busy ? "Searching…" : "Find record"}
              <ArrowRight size={17} />
            </button>
          </form>
          <ErrorBox error={error} />
          <p className="lookup-tip">
            Search matches the beginning of a name, ID or number. Malayalam
            names are supported.
          </p>
          {searched && (
            <div className="search-results">
              {results.length ? (
                results.map((r) => (
                  <Link
                    to={`/p/${type}/${r.id}`}
                    className="search-result"
                    key={r.id}
                  >
                    <div className="avatar">{r.name.slice(0, 2)}</div>
                    <div>
                      <strong>{r.name}</strong>
                      <small>
                        {r.id} {r.subMahalName ? "· " + r.subMahalName : ""}
                      </small>
                    </div>
                    <ArrowRight size={18} />
                  </Link>
                ))
              ) : (
                <Empty
                  title="No matching records"
                  text="Try a permanent ID or the first few letters of the name."
                />
              )}
              {results.length === 20 && (
                <small>
                  Showing the first 20 matches. Type more characters to narrow
                  your search.
                </small>
              )}
            </div>
          )}
        </section>
        <div className="public-features">
          <div>
            <ShieldCheck />
            <h3>A clear contribution history</h3>
            <p>See assessed dues, payments and advances in one place.</p>
          </div>
          <div>
            <QrCode />
            <h3>One scan, one record</h3>
            <p>The QR on your ID card opens your current community profile.</p>
          </div>
          <div>
            <Home />
            <h3>Always part of your Mahal</h3>
            <p>Your member ID stays with you when you change houses.</p>
          </div>
        </div>
      </main>
      <footer className="public-footer">
        {settings?.name || "Mahal Accounts"} ·{" "}
        {settings?.contact ||
          "Contact your Mahal administrator for corrections."}
        {isDemo && <span>Fictional demo records</span>}
      </footer>
      {scan && <Scanner onClose={() => setScan(false)} />}
    </div>
  );
}
function Scanner({ onClose }: { onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null),
    controls = useRef<IScannerControls | null>(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  useEffect(() => {
    let active = true;
    import("@zxing/browser")
      .then(({ BrowserQRCodeReader }) => {
        if (!active) return;
        return new BrowserQRCodeReader().decodeFromConstraints(
          { video: { facingMode: "environment" } },
          video.current!,
          (result) => {
            if (!result || !active) return;
            try {
              const route = scannedRecordRoute(result.getText());
              controls.current?.stop();
              navigate(route);
              onClose();
            } catch (e) {
              setError((e as Error).message);
            }
          },
        );
      })
      .then((c) => {
        if (!c) return;
        if (!active) c.stop();
        else controls.current = c;
      })
      .catch(() =>
        setError(
          "Camera access is unavailable. Close this dialog and search by name or ID instead.",
        ),
      );
    return () => {
      active = false;
      controls.current?.stop();
    };
  }, [navigate, onClose]);
  return (
    <Dialog title="Scan a Mahal QR code" onClose={onClose}>
      <video ref={video} className="scanner-video" muted playsInline />
      <p>Point your camera at a member card or receipt QR code.</p>
      <ErrorBox error={error} />
    </Dialog>
  );
}
export function PublicProfile() {
  const { type = "member", id = "" } = useParams();
  const [record, setRecord] = useState<DocumentData | null>(null),
    [house, setHouse] = useState<DocumentData | null>(null),
    [settings, setSettings] = useState<DocumentData | null>(null),
    [dues, setDues] = useState<Due[]>([]),
    [receipts, setReceipts] = useState<DocumentData[]>([]),
    [credits, setCredits] = useState<DocumentData[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [more, setMore] = useState(false);
  useEffect(() => {
    let active = true;
    (async () => {
      const [r, st] = await Promise.all([
        publicDoc(type === "member" ? "publicMembers" : "publicHouses", id),
        publicDoc("publicSettings", "mahal"),
      ]);
      if (!active) return;
      setRecord(r);
      setSettings(st);
      if (r && type === "member")
        setHouse(await publicDoc("publicHouses", r.houseId));
      else setHouse(r);
      if (r && st?.publicHistory) {
        const [d, rs, cs] = await Promise.all([
          publicList("publicDues", id),
          publicList("publicReceipts", id),
          publicList("publicCredits", id),
        ]);
        if (active) {
          setDues(d as Due[]);
          setReceipts(rs);
          setCredits(cs);
          setMore(d.length === 100 || rs.length === 100 || cs.length === 100);
        }
      }
    })()
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [type, id]);
  async function loadMore() {
    try {
      const [d, r, c] = await Promise.all([
        publicList("publicDues", id, dues.at(-1)?.id),
        publicList("publicReceipts", id, receipts.at(-1)?.id),
        publicList("publicCredits", id, credits.at(-1)?.id),
      ]);
      setDues([...dues, ...(d as Due[])]);
      setReceipts([...receipts, ...r]);
      setCredits([...credits, ...c]);
      setMore(d.length === 100 || r.length === 100 || c.length === 100);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="public-app">
      <PublicHeader name={settings?.name} />
      <main className="public-profile">
        <Link className="back-link" to="/">
          <ArrowLeft size={16} />
          Back to search
        </Link>
        <ErrorBox error={error} />
        {loading ? (
          <div className="loading">Loading record…</div>
        ) : record ? (
          <>
            <section className="panel profile-card">
              <div className="profile-heading">
                <div className="avatar large">{record.name.slice(0, 2)}</div>
                <div>
                  <div className="eyebrow">{type.toUpperCase()} RECORD</div>
                  <h1>{record.name}</h1>
                  <span>
                    {id} · {house?.subMahalName}
                  </span>
                </div>
                <Badge tone={record.active ? "green" : "neutral"}>
                  {record.active ? "Active" : "Inactive"}
                </Badge>
              </div>
              <div className="detail-grid">
                <div>
                  <span>House</span>
                  <strong>
                    {house?.name} · {house?.number}
                  </strong>
                </div>
                {record.phone && (
                  <div>
                    <span>Phone</span>
                    <strong>{record.phone}</strong>
                  </div>
                )}
                {house?.address && (
                  <div>
                    <span>Address</span>
                    <strong>{house.address}</strong>
                  </div>
                )}
                <div>
                  <span>Sub Mahal</span>
                  <strong>{house?.subMahalName}</strong>
                </div>
              </div>
            </section>
            {settings?.publicHistory ? (
              <>
                <div className="profile-totals">
                  <div>
                    <span>Assessed</span>
                    <strong>{money(sum(dues, (d) => d.assessed))}</strong>
                  </div>
                  <div>
                    <span>Paid against dues</span>
                    <strong>{money(sum(dues, (d) => d.paid))}</strong>
                  </div>
                  <div>
                    <span>Outstanding</span>
                    <strong>{money(sum(dues, outstanding))}</strong>
                  </div>
                  <div>
                    <span>Advance credit</span>
                    <strong>{money(sum(credits, (c) => c.amount))}</strong>
                  </div>
                </div>
                {more && (
                  <div className="hint-box">
                    Totals cover loaded records. Load all pages to see the
                    complete statement.
                  </div>
                )}
                <section className="panel">
                  <div className="panel-heading">
                    <h2>Fund-wise payment status</h2>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>FUND / PERIOD</th>
                          <th>ASSESSED</th>
                          <th>PAID</th>
                          <th>WAIVED</th>
                          <th>OUTSTANDING</th>
                          <th>STATUS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dues.map((d) => (
                          <tr key={d.id}>
                            <td>
                              {d.fundTitle}
                              <small>{d.period}</small>
                            </td>
                            <td>{money(d.assessed)}</td>
                            <td>{money(d.paid)}</td>
                            <td>{money(d.waived)}</td>
                            <td>{money(outstanding(d))}</td>
                            <td>
                              <Badge
                                tone={
                                  dueStatus(d) === "paid" ? "green" : "gold"
                                }
                              >
                                {dueStatus(d)}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!dues.length && (
                    <Empty
                      title="Not assessed"
                      text="No dues have been generated for this record. This does not indicate a paid balance."
                    />
                  )}
                </section>
                <section className="panel">
                  <div className="panel-heading">
                    <h2>Payment receipts</h2>
                  </div>
                  <div className="public-receipts">
                    {receipts.map((r) => (
                      <Link to={"/receipt/" + r.id} key={r.id}>
                        <div>
                          <strong>{r.number}</strong>
                          <small>
                            {r.date} ·{" "}
                            {r.voided
                              ? "Void"
                              : r.refunded
                                ? "Refunded"
                                : r.method}
                          </small>
                        </div>
                        <strong>{money(r.total)}</strong>
                        <ArrowRight size={17} />
                      </Link>
                    ))}
                  </div>
                  {!receipts.length && <Empty title="No payments recorded" />}
                </section>
                {more && (
                  <button
                    className="button secondary"
                    onClick={() => void loadMore()}
                  >
                    Load more statement records
                  </button>
                )}
              </>
            ) : (
              <div className="hint-box">
                Payment history is not published. Contact the administrator for
                your statement.
              </div>
            )}
          </>
        ) : (
          <Empty
            title="Record not found"
            text="Check the ID or contact your Mahal administrator."
          />
        )}
      </main>
    </div>
  );
}
export function CardPage() {
  const { type = "member", id = "" } = useParams();
  const [record, setRecord] = useState<DocumentData | null>(null),
    [settings, setSettings] = useState<DocumentData | null>(null),
    [house, setHouse] = useState<DocumentData | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    (async () => {
      const r = await publicDoc(
        type === "member" ? "publicMembers" : "publicHouses",
        id,
      );
      setRecord(r);
      setSettings(await publicDoc("publicSettings", "mahal"));
      if (r)
        setHouse(
          type === "member" ? await publicDoc("publicHouses", r.houseId) : r,
        );
    })().catch((e) => setError(e.message));
  }, [type, id]);
  return (
    <div className="standalone card-page">
      <div className="print-toolbar">
        <Link className="back-link" to="/admin/directory">
          <ArrowLeft size={16} />
          Back
        </Link>
        <button className="button primary" onClick={() => window.print()}>
          <Printer size={16} />
          Print ID card
        </button>
      </div>
      <ErrorBox error={error} />
      {record && (
        <article className="id-card">
          <div className="id-card-brand">
            <Home size={25} />
            <div>
              <strong>{settings?.name}</strong>
              <small>{type.toUpperCase()} IDENTITY CARD</small>
            </div>
          </div>
          <div className="id-card-body">
            <div>
              <h2>{record.name}</h2>
              <strong className="mono">{record.id}</strong>
              <p>
                {house?.name}
                <br />
                {house?.subMahalName}
              </p>
            </div>
            <QRCodeSVG
              value={appUrl(`/p/${type}/${id}`)}
              title={appUrl(`/p/${type}/${id}`)}
              size={88}
            />
          </div>
          <footer>One community. A lasting connection.</footer>
        </article>
      )}
      <p className="print-help">
        Print at 100% scale. Card size: 85.6 × 54 mm.
      </p>
    </div>
  );
}
