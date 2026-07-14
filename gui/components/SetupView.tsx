"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";
import {
  CliStatus, TeamTemplate,
  applyTeamTemplate, getCliStatus, getTeamTemplates, saveSettings,
} from "@/lib/api";

// First-run splash wizard. A fresh install ships with NO @roles — the user
// picks who they are, gets a matching team template (or starts custom with an
// empty team), chooses how to set up the Claude/Codex CLIs, and lands in a
// fresh empty chat.

const PERSONAS: { id: string; label: string; icon: string; template: string }[] = [
  { id: "business", label: "Business owner", icon: "💼", template: "business" },
  { id: "marketing", label: "Marketer", icon: "📣", template: "marketing" },
  { id: "finance", label: "Finance pro", icon: "🧮", template: "finance" },
  { id: "data", label: "Data analyst", icon: "📊", template: "data" },
  { id: "code", label: "Engineer", icon: "🛠️", template: "code" },
  { id: "creative", label: "Digital artist", icon: "🎨", template: "creative" },
];

export default function SetupView({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [persona, setPersona] = useState<string>("");
  const [templates, setTemplates] = useState<TeamTemplate[]>([]);
  const [teamChoice, setTeamChoice] = useState<"template" | "custom" | null>(null);
  const [cli, setCli] = useState<CliStatus | null>(null);
  const [wantClis, setWantClis] = useState<Set<string>>(new Set());
  const [installing, setInstalling] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    getTeamTemplates().then(setTemplates).catch(() => {});
    getCliStatus().then(setCli).catch(() => {});
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const tpl = templates.find((t) => t.id === (PERSONAS.find((p) => p.id === persona)?.template ?? ""));

  async function finishTeamStep() {
    setErr(""); setBusy(true);
    try {
      if (teamChoice === "template" && tpl) await applyTeamTemplate(tpl.id);
      setStep(3);
    } catch (e) { setErr(e instanceof Error ? e.message : "could not create the team"); }
    setBusy(false);
  }

  async function autoInstall() {
    setErr(""); setInstalling(true);
    try {
      const { installClis } = await import("@/lib/api");
      setCli(await installClis([...wantClis]));
      pollRef.current = setInterval(async () => {
        const s = await getCliStatus().catch(() => null);
        if (!s) return;
        setCli(s);
        if (s.installing.length === 0) {
          if (pollRef.current) clearInterval(pollRef.current);
          setInstalling(false);
        }
      }, 2500);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "install failed");
      setInstalling(false);
    }
  }

  async function finish() {
    setBusy(true);
    try { await saveSettings({ onboarded: true }); } catch { /* offline — the wizard shows again next launch */ }
    onDone();
  }

  return (
    <div className="setup-splash">
      <div className="setup-card">
        <div className="setup-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/orkesai-icon.png" alt="OrkesAI" width={44} height={44} style={{ borderRadius: 11 }} />
          <h1>Welcome to OrkesAI</h1>
          <p className="setup-sub">Your local multi-agent workspace. Two quick questions and you&apos;re in.</p>
        </div>
        <div className="setup-steps">
          {[1, 2, 3].map((n) => (
            <span key={n} className={`setup-dot ${step >= n ? "on" : ""}`} />
          ))}
        </div>

        {step === 1 && (
          <>
            <h2>Who are you?</h2>
            <p className="setup-help">This only picks a starting team — everything stays editable.</p>
            <div className="setup-grid">
              {PERSONAS.map((p) => (
                <button key={p.id} className={`setup-tile ${persona === p.id ? "sel" : ""}`}
                  onClick={() => { setPersona(p.id); setTeamChoice("template"); setStep(2); }}>
                  <span className="setup-tile-icon emoji-glyph">{p.icon}</span>
                  {p.label}
                </button>
              ))}
            </div>
            <button className="setup-skip" onClick={() => { setPersona(""); setTeamChoice("custom"); setStep(2); }}>
              None of these — I&apos;ll build my own setup <Icon name="chevron" size={13} />
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <h2>Your starting team</h2>
            {tpl && teamChoice !== "custom" ? (
              <>
                <p className="setup-help">
                  As a {PERSONAS.find((p) => p.id === persona)?.label.toLowerCase()}, you get the
                  <b> {tpl.label}</b> — three @roles you can message, mention in groups, and edit any time.
                </p>
                <div className="setup-roles">
                  {tpl.roles.map((r) => (
                    <span key={r.name} className="setup-role">
                      <span className="emoji-glyph">{r.icon}</span> @{r.name.toLowerCase().replace(/\W+/g, "-")}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <p className="setup-help">
                <b>Custom / advanced:</b> start with an empty team — no @roles at all. Create exactly
                the agents you want later from the sidebar (<b>Team → add</b>), each with its own
                backend, model and instructions.
              </p>
            )}
            <div className="setup-actions">
              <button className="btn" onClick={() => setStep(1)}>Back</button>
              <span className="spacer" />
              {tpl && teamChoice !== "custom" && (
                <button className="btn" disabled={busy} onClick={() => { setTeamChoice("custom"); }}>
                  Start empty instead
                </button>
              )}
              <button className="btn primary" disabled={busy} onClick={finishTeamStep}>
                {busy ? "Setting up…" : teamChoice === "custom" ? "Continue with empty team" : "Use this team"}
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2>Claude &amp; Codex subscriptions <span className="setup-opt">optional</span></h2>
            <p className="setup-help">
              If you pay for Claude (claude.ai) or ChatGPT, OrkesAI can use those subscriptions as
              backends through their official CLIs — no API keys, no per-token cost.
            </p>
            <div className="setup-clis">
              {(["claude", "codex"] as const).map((name) => {
                const have = !!cli?.[name];
                const busy2 = cli?.installing.includes(name);
                const error = cli?.errors?.[name];
                return (
                  <label key={name} className={`setup-cli ${have ? "ok" : ""}`}>
                    <input type="checkbox" className="toggle" disabled={have || installing}
                      checked={have || wantClis.has(name)}
                      onChange={(e) => setWantClis((w) => {
                        const n = new Set(w);
                        e.target.checked ? n.add(name) : n.delete(name);
                        return n;
                      })} />
                    <span className="setup-cli-name">{name === "claude" ? "Claude Code CLI" : "Codex CLI"}</span>
                    <span className={`env-badge ${have ? "on" : "off"}`}>
                      {have ? "installed" : busy2 ? "installing…" : "not installed"}
                    </span>
                    {error && <span className="form-err">{error}</span>}
                  </label>
                );
              })}
            </div>
            {err && <p className="form-err">{err}</p>}
            <div className="setup-actions">
              <button className="btn" onClick={() => setStep(2)}>Back</button>
              <span className="spacer" />
              <button className="btn" disabled={installing} onClick={finish} title="Install the CLIs yourself later (npm install -g @anthropic-ai/claude-code / @openai/codex), then log in with `claude login` / `codex login`">
                Advanced — I&apos;ll install myself
              </button>
              {wantClis.size > 0 && ![...wantClis].every((n) => cli?.[n as "claude" | "codex"]) ? (
                <button className="btn primary" disabled={installing} onClick={autoInstall}>
                  {installing ? "Installing…" : "Install for me"}
                </button>
              ) : (
                <button className="btn primary" disabled={installing} onClick={finish}>
                  Finish setup
                </button>
              )}
            </div>
            {installing && <p className="setup-help">Installing via npm — this can take a minute. You can also finish now; it keeps going in the background.</p>}
            {!installing && cli && cli.installing.length === 0 && wantClis.size > 0 &&
              [...wantClis].every((n) => cli[n as "claude" | "codex"]) && (
              <p className="setup-help" style={{ color: "var(--green)" }}>
                Installed. Run <code>claude login</code> / <code>codex login</code> in a terminal once to connect your subscription, then finish.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
