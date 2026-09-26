import { useRef, useState } from "react";
import {
  DatabaseBackup,
  Download,
  FileCheck2,
  FileUp,
  Upload,
} from "lucide-react";
import Papa from "papaparse";
import { useApp } from "../data/context";
import { isDemo } from "../data/firebase";
import { restoreDemo, validateBackup } from "../data/repository";
import { digest, parseCsv, rowCommand, templates } from "../data/csv";
import type { ImportKind } from "../data/csv";
import { execute } from "../domain/engine";
import { download, today, uid } from "../domain/utils";
import { Badge, Dialog, ErrorBox, Field, PageTitle } from "../ui/components";
export function ImportPage() {
  const { state: s, run, getCurrent, notify, refresh } = useApp();
  const [kind, setKind] = useState<ImportKind>("houses"),
    [fileName, setFileName] = useState(""),
    [rows, setRows] = useState<Record<string, string>[]>([]),
    [headers, setHeaders] = useState<string[]>([]),
    [mapping, setMapping] = useState<Record<string, string>>({}),
    [update, setUpdate] = useState(false),
    [validation, setValidation] = useState<{ row: number; error: string }[]>(
      [],
    ),
    [checked, setChecked] = useState(false),
    [confirm, setConfirm] = useState(false),
    [progress, setProgress] = useState(""),
    [error, setError] = useState(""),
    [manifest, setManifest] = useState<
      { row: number; status: string; message: string }[]
    >([]),
    [restore, setRestore] = useState<ReturnType<typeof validateBackup> | null>(
      null,
    );
  const upload = useRef<HTMLInputElement>(null),
    restoreInput = useRef<HTMLInputElement>(null);
  const mapped = () =>
    rows.map((r) =>
      Object.fromEntries(templates[kind].map((k) => [k, r[mapping[k]] || ""])),
    );
  async function file(file?: File) {
    if (!file) return;
    setError("");
    try {
      const result = parseCsv(await file.text());
      setRows(result.rows);
      setHeaders(result.headers);
      setMapping(
        Object.fromEntries(
          templates[kind].map((k) => [
            k,
            result.headers.find((h) => h.toLowerCase() === k.toLowerCase()) ||
              "",
          ]),
        ),
      );
      setFileName(file.name);
      setChecked(false);
      setManifest([]);
      setValidation([]);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function validate() {
    setError("");
    let next = getCurrent();
    const errors: { row: number; error: string }[] = [];
    const data = mapped();
    const jobId =
      "import-" +
      (await digest(JSON.stringify({ kind, data, update }))).slice(0, 24);
    for (const [i, r] of data.entries()) {
      try {
        if (next.operations.some((o) => o.id === `${jobId}-${i}`)) continue;
        next = execute(next, rowCommand(kind, r, next, update), {
          operationId: `preview-${i}-${uid()}`,
          now: new Date().toISOString(),
          actor: "preview",
        });
      } catch (e) {
        errors.push({ row: i + 2, error: (e as Error).message });
      }
    }
    setValidation(errors);
    setChecked(true);
  }
  async function importRows() {
    setConfirm(false);
    setProgress("Preparing import…");
    setError("");
    const result: { row: number; status: string; message: string }[] = [];
    const data = mapped();
    const jobId =
      "import-" +
      (await digest(JSON.stringify({ kind, data, update }))).slice(0, 24);
    const done: string[] = [];
    try {
      for (let i = 0; i < data.length; i++) {
        setProgress(`Importing ${i + 1} of ${data.length}…`);
        const opId = `${jobId}-${i}`;
        try {
          if (getCurrent().operations.some((o) => o.id === opId)) {
            result.push({
              row: i + 2,
              status: "skipped",
              message: "Already imported",
            });
            done.push(opId);
          } else {
            await run(rowCommand(kind, data[i], getCurrent(), update), opId);
            done.push(opId);
            result.push({ row: i + 2, status: "success", message: "Imported" });
          }
        } catch (e) {
          result.push({
            row: i + 2,
            status: "error",
            message: (e as Error).message,
          });
        }
        if ((i + 1) % 10 === 0 || i === data.length - 1)
          await run({
            type: "saveImportJob",
            value: {
              id: jobId,
              kind,
              fileName,
              completed: done,
              errors: result
                .filter((r) => r.status === "error")
                .map((r) => `Row ${r.row}: ${r.message}`),
              createdAt: new Date().toISOString(),
              status: i === data.length - 1 ? "complete" : "running",
            },
          });
      }
      setManifest(result);
      setChecked(false);
      notify(
        `Import complete: ${result.filter((r) => r.status === "success").length} added, ${result.filter((r) => r.status === "error").length} errors`,
      );
    } catch (e) {
      setError((e as Error).message);
      setManifest(result);
    } finally {
      setProgress("");
    }
  }
  async function backup() {
    try {
      await run({
        type: "saveSettings",
        value: { ...getCurrent().settings[0], lastBackup: today() },
      });
      download(
        `mahal-backup-${today()}.json`,
        JSON.stringify(
          {
            format: "mahal-backup-v1",
            exportedAt: new Date().toISOString(),
            data: getCurrent(),
          },
          null,
          2,
        ),
        "application/json",
      );
      notify("Complete backup downloaded");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <PageTitle
        title="Bring your records together."
        description="Preview every import. Keep a complete copy of your community accounts."
      />
      <div className="import-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Import a CSV file</h2>
              <p>UTF-8 files preserve Malayalam and leading zeros.</p>
            </div>
            <FileUp size={22} />
          </div>
          <div className="panel-body">
            <div className="form-grid">
              <Field label="Import type">
                <select
                  value={kind}
                  disabled={!!progress}
                  onChange={(e) => {
                    setKind(e.target.value as ImportKind);
                    setRows([]);
                    setChecked(false);
                  }}
                >
                  {Object.keys(templates).map((k) => (
                    <option key={k} value={k}>
                      {
                        (
                          {
                            houses: "Houses",
                            members: "Members",
                            subMahals: "Sub Mahals",
                            funds: "Fund definitions & rates",
                            opening: "Opening wallet balances",
                            dues: "Outstanding historical dues",
                            receipts: "Historical receipts",
                          } as Record<string, string>
                        )[k]
                      }
                    </option>
                  ))}
                </select>
              </Field>
              <div className="template-link">
                <button
                  className="button secondary"
                  onClick={() =>
                    download(
                      `mahal-${kind}-template.csv`,
                      "\ufeff" + templates[kind].join(",") + "\r\n",
                      "text/csv;charset=utf-8",
                    )
                  }
                >
                  <Download size={15} />
                  Download template
                </button>
              </div>
            </div>
            <button
              className="upload-zone"
              disabled={!!progress}
              onClick={() => upload.current?.click()}
            >
              <Upload size={30} />
              <strong>{fileName || "Choose your CSV file"}</strong>
              <span>Up to 10,000 rows per import · .csv</span>
            </button>
            <input
              hidden
              ref={upload}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => void file(e.target.files?.[0])}
            />
            <label className="check">
              <input
                type="checkbox"
                checked={update}
                disabled={!!progress}
                onChange={(e) => {
                  setUpdate(e.target.checked);
                  setChecked(false);
                }}
              />
              Explicit update mode for existing IDs (identities / configuration)
            </label>
            {kind === "receipts" && (
              <div className="hint-box">
                Historical receipts must predate cutover. They appear on
                statements without changing live wallet balances. Import
                outstanding dues separately.
              </div>
            )}
            {rows.length > 0 && (
              <>
                <h3>Map your columns</h3>
                <div className="mapping-grid">
                  {templates[kind].map((k) => (
                    <Field key={k} label={k}>
                      <select
                        disabled={!!progress}
                        value={mapping[k] || ""}
                        onChange={(e) => {
                          setMapping({ ...mapping, [k]: e.target.value });
                          setChecked(false);
                        }}
                      >
                        <option value="">Not mapped</option>
                        {headers.map((h) => (
                          <option key={h}>{h}</option>
                        ))}
                      </select>
                    </Field>
                  ))}
                </div>
                <div className="preview-list">
                  {mapped()
                    .slice(0, 3)
                    .map((r, i) => (
                      <div key={i}>
                        <strong>Row {i + 2}</strong>
                        <small>
                          {Object.values(r).filter(Boolean).join(" · ")}
                        </small>
                      </div>
                    ))}
                </div>
                <div className="form-actions">
                  <Badge>{rows.length} rows</Badge>
                  <button
                    className="button secondary"
                    disabled={!!progress}
                    onClick={() => void validate()}
                  >
                    <FileCheck2 size={16} />
                    Validate & preview
                  </button>
                  <button
                    className="button primary"
                    disabled={!checked || validation.length > 0 || !!progress}
                    onClick={() => setConfirm(true)}
                  >
                    {progress || "Import validated rows"}
                  </button>
                </div>
                {checked && (
                  <div
                    className={`hint-box ${validation.length ? "amber" : ""}`}
                  >
                    {validation.length
                      ? `${validation.length} row errors. Correct the CSV and upload again.`
                      : "All rows passed validation. Ready for confirmation."}
                  </div>
                )}
                {validation.length > 0 && (
                  <div className="validation-errors">
                    {validation.slice(0, 20).map((v) => (
                      <p key={v.row}>
                        Row {v.row}: {v.error}
                      </p>
                    ))}
                    <button
                      className="text-link"
                      onClick={() =>
                        download(
                          "validation-errors.csv",
                          Papa.unparse(validation, { escapeFormulae: true }),
                          "text/csv",
                        )
                      }
                    >
                      Download all errors
                    </button>
                  </div>
                )}
              </>
            )}
            <ErrorBox error={error} />
            {manifest.length > 0 && (
              <div className="hint-box">
                <strong>Import manifest is ready.</strong>
                <p>
                  {manifest.filter((r) => r.status === "success").length}{" "}
                  imported ·{" "}
                  {manifest.filter((r) => r.status === "skipped").length}{" "}
                  skipped ·{" "}
                  {manifest.filter((r) => r.status === "error").length} errors
                </p>
                <button
                  className="button secondary"
                  onClick={() =>
                    download(
                      "import-manifest.csv",
                      "\ufeff" +
                        Papa.unparse(manifest, { escapeFormulae: true }),
                      "text/csv",
                    )
                  }
                >
                  Download manifest
                </button>
              </div>
            )}
          </div>
        </section>
        <div>
          <section className="panel backup-card">
            <div className="backup-icon">
              <DatabaseBackup size={30} />
            </div>
            <h2>Your complete backup</h2>
            <p>
              Download identities, assessments, receipts, ledger events, audit
              history and sequence counters in one versioned file.
            </p>
            <div className="backup-date">
              Last downloaded{" "}
              <strong>{s.settings[0].lastBackup || "Not recorded"}</strong>
            </div>
            <button
              className="button primary full"
              onClick={() => void backup()}
            >
              <Download size={16} />
              Download full backup
            </button>
            <p className="muted small-text">
              Keep exported personal and financial records in a secure location.
            </p>
            <button
              className="button secondary full"
              onClick={() => restoreInput.current?.click()}
            >
              Validate {isDemo ? "& restore demo backup" : "backup file"}
            </button>
            <input
              hidden
              ref={restoreInput}
              type="file"
              accept=".json"
              onChange={async (e) => {
                try {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const data = validateBackup(JSON.parse(await f.text()));
                  if (isDemo) setRestore(data);
                  else
                    notify(
                      "Backup structure validated. Use the documented restore script for an empty Firebase project.",
                    );
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            />
          </section>
          <section className="panel panel-body">
            <h3>Recommended import order</h3>
            <ol className="import-order">
              <li>Sub Mahals and houses</li>
              <li>Members linked to house IDs</li>
              <li>Funds and period rates</li>
              <li>Opening wallet balances</li>
              <li>Outstanding historical dues</li>
              <li>Optional historical receipts</li>
            </ol>
            <p className="muted">
              Reconcile opening cash at {s.settings[0].cutover}. Earlier
              receipts are statement-only records.
            </p>
          </section>
        </div>
      </div>
      {confirm && (
        <Dialog title="Confirm the import" onClose={() => setConfirm(false)}>
          <p>
            {rows.length} validated rows from <strong>{fileName}</strong> will
            be imported into this workspace.
          </p>
          <p>
            Mode:{" "}
            {update ? "Explicit updates permitted" : "Create new records only"}.
            Each successful row has a stable import marker so the same file can
            be resumed.
          </p>
          <div className="form-actions">
            <button
              className="button secondary"
              onClick={() => setConfirm(false)}
            >
              Cancel
            </button>
            <button
              className="button primary"
              onClick={() => void importRows()}
            >
              Confirm import
            </button>
          </div>
        </Dialog>
      )}
      {restore && (
        <Dialog
          title="Restore this demo backup?"
          onClose={() => setRestore(null)}
        >
          <p>
            This replaces this browser's demo records with{" "}
            {restore.members.length} members, {restore.houses.length} houses and{" "}
            {restore.receipts.length} receipts from the selected backup.
          </p>
          <div className="form-actions">
            <button
              className="button secondary"
              onClick={() => setRestore(null)}
            >
              Cancel
            </button>
            <button
              className="button primary"
              onClick={() => {
                restoreDemo(restore);
                setRestore(null);
                void refresh();
                notify("Demo backup restored");
              }}
            >
              Restore backup
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}
