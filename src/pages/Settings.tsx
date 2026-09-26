import { useState } from "react";
import { Check, ExternalLink, Pencil, ShieldCheck } from "lucide-react";
import { useApp } from "../data/context";
import { isDemo } from "../data/firebase";
import { resetDemo, rebuildPublic } from "../data/repository";
import {
  AsyncForm,
  Badge,
  Dialog,
  Field,
  PageTitle,
  str,
} from "../ui/components";
export function SettingsPage() {
  const { state: s, run, notify, refresh } = useApp();
  const [sub, setSub] = useState(""),
    [reset, setReset] = useState(false);
  const settings = s.settings[0];
  const [publishing, setPublishing] = useState(false);
  return (
    <>
      <PageTitle
        title="Make this your Mahal."
        description="Your community details, publication choices and Sub Mahals."
      />
      <div className="settings-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Mahal details</h2>
              <p>Used on receipts, ID cards and the public portal</p>
            </div>
          </div>
          <div className="panel-body">
            <AsyncForm
              submit="Save settings"
              onSubmit={async (f) => {
                await run({
                  type: "saveSettings",
                  value: {
                    ...settings,
                    name: str(f, "name"),
                    address: str(f, "address"),
                    contact: str(f, "contact"),
                    logo: str(f, "logo"),
                    timezone: str(f, "timezone"),
                    cutover: str(f, "cutover"),
                    publicPhone: f.has("publicPhone"),
                    publicAddress: f.has("publicAddress"),
                    publicHistory: f.has("publicHistory"),
                  },
                });
                notify("Settings saved");
              }}
            >
              <div className="form-grid">
                <Field label="Mahal name">
                  <input name="name" required defaultValue={settings.name} />
                </Field>
                <Field label="Receipt contact">
                  <input name="contact" defaultValue={settings.contact} />
                </Field>
                <Field label="Reporting timezone">
                  <input
                    name="timezone"
                    required
                    defaultValue={settings.timezone}
                  />
                </Field>
                <Field label="Accounting cutover date">
                  <input
                    name="cutover"
                    type="date"
                    required
                    defaultValue={settings.cutover}
                  />
                </Field>
              </div>
              <Field label="Address">
                <textarea name="address" defaultValue={settings.address} />
              </Field>
              <Field
                label="Logo path or HTTPS URL"
                hint="Bundle a logo under public/ and enter /logo.png."
              >
                <input name="logo" defaultValue={settings.logo} />
              </Field>
              <div className="settings-divider" />
              <h3>Public profile information</h3>
              <p className="muted">
                Public information is available to anyone, including outside
                this website. DOB, age evidence, transaction references and
                audit notes remain private.
              </p>
              <label className="check">
                <input
                  type="checkbox"
                  name="publicPhone"
                  defaultChecked={settings.publicPhone}
                />
                Publish phone numbers and allow phone search
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  name="publicAddress"
                  defaultChecked={settings.publicAddress}
                />
                Publish full house addresses
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  name="publicHistory"
                  defaultChecked={settings.publicHistory}
                />
                Publish dues, receipts, waivers and advance balances
              </label>
            </AsyncForm>
          </div>
        </section>
        <div>
          <section className="panel">
            <div className="panel-heading">
              <h2>Sub Mahals</h2>
              <Badge>10 areas</Badge>
            </div>
            <div className="sub-list">
              {s.subMahals.map((m) => (
                <div key={m.id}>
                  <span className="sub-number">
                    {String(m.order).padStart(2, "0")}
                  </span>
                  <strong>{m.name}</strong>
                  <button
                    className="icon-button"
                    aria-label={"Rename " + m.name}
                    onClick={() => setSub(m.id)}
                  >
                    <Pencil size={15} />
                  </button>
                </div>
              ))}
            </div>
          </section>
          <section className="panel connection-card">
            <ShieldCheck size={27} />
            <h2>{isDemo ? "Demo workspace" : "Firebase connected"}</h2>
            <p>
              {isDemo
                ? "This demo stores fictional records in your browser. Add Firebase configuration to connect your live Mahal."
                : "Only the configured administrator can edit this workspace."}
            </p>
            <div className="setup-check">
              <Check size={15} />
              React + TypeScript application
            </div>
            <div className="setup-check">
              <Check size={15} />
              Central accounting & public lookup
            </div>
            <a
              href="https://console.firebase.google.com/"
              target="_blank"
              rel="noreferrer"
              className="text-link"
            >
              Firebase console <ExternalLink size={14} />
            </a>
            <button
              className="button secondary full"
              disabled={publishing}
              onClick={async () => {
                setPublishing(true);
                try {
                  await rebuildPublic();
                  notify("Public profiles refreshed");
                } catch (e) {
                  notify((e as Error).message);
                } finally {
                  setPublishing(false);
                }
              }}
            >
              {publishing
                ? "Refreshing publication…"
                : "Refresh public profiles"}
            </button>
            {isDemo && (
              <button
                className="button secondary full"
                onClick={() => setReset(true)}
              >
                Reset sample workspace
              </button>
            )}
          </section>
        </div>
      </div>
      {sub && (
        <Dialog title="Rename Sub Mahal" onClose={() => setSub("")}>
          <AsyncForm
            onCancel={() => setSub("")}
            onSubmit={async (f) => {
              await run({
                type: "saveSubMahal",
                value: {
                  ...s.subMahals.find((m) => m.id === sub)!,
                  name: str(f, "name"),
                },
              });
              notify("Sub Mahal updated");
              setSub("");
            }}
          >
            <Field label="Name">
              <input
                name="name"
                required
                defaultValue={s.subMahals.find((m) => m.id === sub)?.name}
              />
            </Field>
          </AsyncForm>
        </Dialog>
      )}
      {reset && (
        <Dialog title="Reset demo data?" onClose={() => setReset(false)}>
          <p>
            This replaces changes made in this browser's demo with the original
            fictional sample records.
          </p>
          <div className="form-actions">
            <button
              className="button secondary"
              onClick={() => setReset(false)}
            >
              Cancel
            </button>
            <button
              className="button primary"
              onClick={() => {
                resetDemo();
                void refresh();
                setReset(false);
                notify("Sample workspace restored");
              }}
            >
              Reset demo
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}
