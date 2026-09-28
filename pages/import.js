import {
  el,
  replace,
  button,
  input,
  select,
  field,
  check,
  form,
  dialog,
  pageTitle,
  table,
  str,
  notify,
  alertBox,
  showError,
} from "../lib/dom.js";
import { store, run, refresh } from "../lib/store.js";
import { validateBackup, restoreDemo } from "../lib/repository.js";
import { isDemo } from "../lib/firebase.js";
import { parseCsv, rowCommand, templates } from "../domain/csv.js";
import { execute } from "../domain/engine.js";
import { today, uid, digest, download } from "../lib/browser.js";
import { csvString } from "../lib/csv-export.js";
export function render() {
  let rows = [],
    headers = [],
    fileName = "",
    mapping = {},
    checked = false,
    manifest = [],
    busy = false;
  const error = alertBox(),
    progress = el("p", { role: "status" }),
    mappingBox = el("div", { class: "mapping-grid" }),
    validation = el("div"),
    manifestBox = el("div"),
    kind = select("kind", Object.keys(templates), "houses"),
    dateOrder = select("dateOrder", [["DMY", "Day / month / year (DD/MM/YYYY)"], ["MDY", "Month / day / year (MM/DD/YYYY)"]], "DMY"),
    update = check(
      "Explicitly update existing identity / fund IDs",
      "update",
      false,
    ),
    updateInput = update.querySelector("input"),
    upload = input("file", "", {
      type: "file",
      accept: ".csv,text/csv",
      "aria-label": "Upload CSV",
    });
  const apply = button(
      "Import validated rows",
      confirmImport,
      "button primary",
      { disabled: true },
    ),
    validate = button("Validate rows", validateRows, "button secondary", {
      disabled: true,
    });
  const mapped = () =>
    rows.map((row) =>
      Object.fromEntries(
        templates[kind.value].map((key) => [key, row[mapping[key]] || ""]),
      ),
    );
  function invalidate() {
    checked = false;
    apply.disabled = true;
    replace(validation);
  }
  kind.addEventListener("change", () => {
    rows = [];
    headers = [];
    upload.value = "";
    replace(mappingBox);
    invalidate();
    validate.disabled = true;
  });
  updateInput.addEventListener("change", invalidate);
  dateOrder.addEventListener("change", invalidate);
  upload.addEventListener("change", async () => {
    if (busy || !upload.files[0]) return;
    showError(error, "");
    try {
      const file = upload.files[0],
        result = parseCsv(await file.text());
      rows = result.rows;
      headers = result.headers;
      fileName = file.name;
      mapping = Object.fromEntries(
        templates[kind.value].map((key) => [
          key,
          headers.find((h) => h.toLowerCase() === key.toLowerCase()) || "",
        ]),
      );
      replace(
        mappingBox,
        ...templates[kind.value].map((key) => {
          const control = select(
            key,
            [["", "Not mapped"], ...headers],
            mapping[key],
          );
          control.addEventListener("change", () => {
            mapping[key] = control.value;
            invalidate();
          });
          return field(key, control);
        }),
      );
      invalidate();
      validate.disabled = !rows.length;
      replace(manifestBox);
      progress.textContent = `${rows.length} rows loaded from ${fileName}`;
    } catch (e) {
      showError(error, e);
    }
  });
  async function job() {
    const data = mapped();
    return {
      data,
      id:
        "import-" +
        (
          await digest(
            JSON.stringify({
              kind: kind.value,
              data,
              update: updateInput.checked,
              ...(dateOrder.value === "MDY" ? { dateOrder: "MDY" } : {}),
            }),
          )
        ).slice(0, 24),
    };
  }
  async function validateRows() {
    showError(error, "");
    try {
      let next = store.state;
      const { data, id } = await job(),
        errors = [];
      const importedRows = new Set(next.operations.flatMap((o) =>
        o.rowIds || [o.id],
      ));
      for (const [i, row] of data.entries()) {
        try {
          if (importedRows.has(`${id}-${i}`)) continue;
          next = execute(
            next,
            rowCommand(kind.value, row, next, updateInput.checked, dateOrder.value),
            {
              operationId: `preview-${i}-${uid()}`,
              now: new Date().toISOString(),
              actor: "preview",
            },
          );
        } catch (e) {
          errors.push({ row: i + 2, error: e.message });
        }
      }
      replace(
        validation,
        el(
          "p",
          { class: errors.length ? "hint-box amber" : "hint-box" },
          `${data.length - errors.length} rows valid or already imported; ${errors.length} errors.`,
        ),
        errors.length &&
          table(
            ["CSV ROW", "ERROR"],
            errors.map((r) => [r.row, r.error]),
          ),
      );
      checked = true;
      apply.disabled = false;
    } catch (e) {
      showError(error, e);
    }
  }
  function confirmImport() {
    if (!checked || busy) return;
    const modal = dialog("Import these records?", []);
    modal.body.append(
      form(
        [
          el(
            "p",
            {},
            `${rows.length} ${kind.value} rows from ${fileName}. Valid rows will be applied, previously imported rows skipped and rejected rows listed in a manifest.`,
          ),
        ],
        "Confirm import",
        async () => {
          modal.close();
          await importRows();
        },
        modal.close,
      ),
    );
  }
  async function importRows() {
    busy = true;
    apply.disabled = true;
    validate.disabled = true;
    upload.disabled = true;
    kind.disabled = true;
    updateInput.disabled = true;
    dateOrder.disabled = true;
    mappingBox.querySelectorAll("select").forEach((s) => (s.disabled = true));
    showError(error, "");
    manifest = [];
    const { id, data } = await job(),
      done = [];
    try {
      if (kind.value === "houses") {
        const prior = new Set(store.state.operations.flatMap((o) =>
          o.rowIds || (o.id.startsWith(id + "-") ? [o.id] : []),
        ));
        let batch = [], committedGroups = 0;
        const checkpoint = async (finished) => run({
          type: "saveImportJob",
          value: {
            id, kind: kind.value, fileName, completed: done,
            errors: manifest.filter((r) => r.status === "error").map((r) => `Row ${r.row}: ${r.message}`),
            createdAt: new Date().toISOString(),
            status: finished ? "complete" : "running",
          },
        });
        const flush = async () => {
          if (!batch.length) return;
          const group = batch;
          batch = [];
          const batchId = `${id}-batch-${group[0].index}`;
          progress.textContent = `Importing ${group[0].index + 1}–${group.at(-1).index + 1} of ${data.length}…`;
          try {
            await run({ type: "importHouseBatch", items: group.map(({ rowId, command }) => ({ rowId, command })) }, batchId);
            for (const item of group) {
              manifest.push({ row: item.index + 2, status: "success", message: "Imported" });
              done.push(item.rowId);
              prior.add(item.rowId);
            }
          } catch (e) {
            for (const item of group)
              manifest.push({ row: item.index + 2, status: "error", message: e.message });
          }
          if (++committedGroups % 5 === 0) await checkpoint(false);
        };
        for (let i = 0; i < data.length; i++) {
          const rowId = `${id}-${i}`;
          if (prior.has(rowId)) {
            manifest.push({ row: i + 2, status: "skipped", message: "Already imported" });
            done.push(rowId);
            continue;
          }
          try {
            if (batch.some((item) => item.command.value.id === data[i].id)) await flush();
            batch.push({ index: i, rowId, command: rowCommand("houses", data[i], store.state, updateInput.checked, dateOrder.value) });
          } catch (e) {
            manifest.push({ row: i + 2, status: "error", message: e.message });
          }
          if (batch.length === 5) await flush();
        }
        await flush();
        await checkpoint(true);
      } else {
      for (let i = 0; i < data.length; i++) {
        progress.textContent = `Importing ${i + 1} of ${data.length}…`;
        const opId = `${id}-${i}`;
        try {
          if (store.state.operations.some((o) => o.id === opId)) {
            manifest.push({
              row: i + 2,
              status: "skipped",
              message: "Already imported",
            });
          } else {
            await run(
              rowCommand(kind.value, data[i], store.state, updateInput.checked, dateOrder.value),
              opId,
            );
            manifest.push({
              row: i + 2,
              status: "success",
              message: "Imported",
            });
          }
          done.push(opId);
        } catch (e) {
          manifest.push({ row: i + 2, status: "error", message: e.message });
        }
        if ((i + 1) % 10 === 0 || i === data.length - 1)
          await run({
            type: "saveImportJob",
            value: {
              id,
              kind: kind.value,
              fileName,
              completed: done,
              errors: manifest
                .filter((r) => r.status === "error")
                .map((r) => `Row ${r.row}: ${r.message}`),
              createdAt: new Date().toISOString(),
              status: i === data.length - 1 ? "complete" : "running",
            },
          });
      }
      }
      progress.textContent = `Import complete: ${manifest.filter((r) => r.status === "success").length} added, ${manifest.filter((r) => r.status === "skipped").length} skipped, ${manifest.filter((r) => r.status === "error").length} errors`;
      notify("Import complete");
    } catch (e) {
      showError(error, e);
    } finally {
      busy = false;
      checked = false;
      upload.disabled = false;
      kind.disabled = false;
      updateInput.disabled = false;
      dateOrder.disabled = false;
      validate.disabled = false;
      mappingBox
        .querySelectorAll("select")
        .forEach((s) => (s.disabled = false));
      replace(
        manifestBox,
        button("Download manifest", () =>
          download(
            "mahal-import-manifest.csv",
            "\ufeff" + csvString(manifest),
            "text/csv;charset=utf-8",
          ),
        ),
        table(
          ["ROW", "STATUS", "MESSAGE"],
          manifest.map((r) => [r.row, r.status, r.message]),
        ),
      );
    }
  }
  const backup = form(
    [
      el(
        "p",
        {},
        "Includes private records, dues, receipts, ledger, history and audit events. Store the JSON file with your controlled records.",
      ),
    ],
    "Download full backup",
    async () => {
      await run({
        type: "saveSettings",
        value: { ...store.state.settings[0], lastBackup: today() },
      });
      download(
        `mahal-backup-${today()}.json`,
        JSON.stringify(
          {
            format: "mahal-backup-v1",
            exportedAt: new Date().toISOString(),
            data: store.state,
          },
          null,
          2,
        ),
        "application/json",
      );
      notify("Complete backup downloaded");
    },
  );
  const restoreStatus = el("div"),
    restoreFile = input("backup", "", {
      type: "file",
      accept: ".json,application/json",
      "aria-label": "Validate backup file",
    });
  restoreFile.addEventListener("change", async () => {
    if (!restoreFile.files[0]) return;
    try {
      const state = validateBackup(
        JSON.parse(await restoreFile.files[0].text()),
      );
      replace(
        restoreStatus,
        el(
          "p",
          { class: "hint-box" },
          `Backup valid: ${state.members.length} members, ${state.receipts.length} receipts.`,
        ),
      );
      if (isDemo)
        restoreStatus.append(
          button("Restore demo backup", () => {
            const modal = dialog("Restore this demo backup?", []);
            modal.body.append(
              form(
                [
                  el(
                    "p",
                    {},
                    "Replace this browser's fictional records with the validated backup.",
                  ),
                ],
                "Restore demo",
                async () => {
                  restoreDemo(state);
                  await refresh();
                  modal.close();
                  location.hash = "/admin";
                },
                modal.close,
              ),
            );
          }),
        );
    } catch (e) {
      replace(
        restoreStatus,
        el("p", { class: "alert danger", role: "alert" }, e.message),
      );
    }
  });
  return el(
    "div",
    {},
    pageTitle(
      "Bring your records together.",
      "Preview every import. Keep a complete copy of your community accounts.",
    ),
    el(
      "div",
      { class: "import-grid" },
      el(
        "section",
        { class: "panel panel-body" },
        el("h2", {}, "Import a CSV file"),
        field("Import type", kind),
        button("Download template", () =>
          download(
            `mahal-${kind.value}-template.csv`,
            "\ufeff" + templates[kind.value].join(",") + "\r\n",
            "text/csv;charset=utf-8",
          ),
        ),
        field("Upload UTF-8 CSV", upload),
        field("CSV date order", dateOrder, "YYYY-MM-DD is always accepted. For slash, dash or dot dates, choose the order used by your spreadsheet. Example: 28/09/2026 → 2026-09-28. Use four-digit years."),
        el("p", { class: "muted" }, "House IDs can use your existing codes, such as H-TMJBDR002: H- followed by 1–64 uppercase letters, numbers, hyphens or underscores. Map the joining-date column to joined; it may be earlier than cutover. Download Sub Mahal IDs from Settings for the subMahalId column."),
        update,
        mappingBox,
        el("div", { class: "form-actions" }, validate, apply),
        error,
        progress,
        validation,
        manifestBox,
      ),
      el(
        "div",
        {},
        el(
          "section",
          { class: "panel panel-body" },
          el("h2", {}, "Full backup"),
          backup,
        ),
        el(
          "section",
          { class: "panel panel-body" },
          el("h2", {}, "Validate a backup"),
          el(
            "p",
            {},
            "Live recovery uses tools/restore.mjs against a separate empty project. See SETUP.md.",
          ),
          restoreFile,
          restoreStatus,
        ),
        el(
          "section",
          { class: "panel panel-body" },
          el("h2", {}, "Saved jobs"),
          table(
            ["FILE / JOB", "STATUS", "COMPLETED"],
            store.state.importJobs
              .slice(-10)
              .reverse()
              .map((j) => [j.fileName, j.status, j.completed.length]),
          ),
        ),
      ),
    ),
  );
}
