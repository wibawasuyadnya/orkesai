"use client";

import { useEffect, useState } from "react";
import Icon from "./Icon";
import {
  Agent,
  Backend,
  EnvItem,
  Integration,
  MemoryItem,
  Settings,
  Usage,
  addIntegration,
  addMcp,
  addMemory,
  deleteMemory,
  getMemories,
  updateMemory,
  addSkill,
  deleteDatabase,
  deleteIntegration,
  getDatabases,
  getEnv,
  getIntegrations,
  getMcp,
  getSettings,
  getSkills,
  getUsage,
  removeMcp,
  removeSkill,
  saveEnv,
  saveSettings,
} from "@/lib/api";

const SECTIONS = [
  { id: "general", label: "General", icon: "sliders" },
  { id: "environment", label: "Environment", icon: "lock" },
  { id: "integrations", label: "Integrations", icon: "link" },
  { id: "memory", label: "Memory", icon: "spark" },
  { id: "usage", label: "Usage", icon: "chart" },
  { id: "skills", label: "Skills", icon: "puzzle" },
  { id: "mcp", label: "MCP", icon: "plug" },
  { id: "databases", label: "Databases", icon: "database" },
  { id: "help", label: "Help", icon: "help" },
  { id: "credit", label: "Credit", icon: "heart" },
] as const;

function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
function num(n: number): string {
  return n.toLocaleString();
}

export default function SettingsModal({
  agents,
  backends,
  onClose,
  onSaved,
}: {
  agents: Agent[];
  backends: Backend[];
  onClose: () => void;
  onSaved: (s: Settings) => void;
}) {
  const [section, setSection] = useState<string>("general");
  const [s, setS] = useState<Settings | null>(null);
  const [validAgents, setValidAgents] = useState<string[]>([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    getSettings()
      .then((r) => {
        setS(r.settings);
        setValidAgents(r.valid_agents);
      })
      .catch(() => setErr("cannot reach the server"));
  }, []);

  async function patch(p: Partial<Settings>) {
    if (!s) return;
    const next = { ...s, ...p };
    setS(next);
    try {
      await saveSettings(p);
      onSaved(next);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "could not save");
    }
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="settings-modal">
        <div className="settings-nav">
          <div className="settings-title">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/orkesai-icon.png" alt="OrkesAI" width={18} height={18} style={{ borderRadius: 5 }} /> Settings
          </div>
          {SECTIONS.map((sec) => (
            <button
              key={sec.id}
              className={`settings-navitem ${section === sec.id ? "sel" : ""}`}
              onClick={() => setSection(sec.id)}
            >
              <Icon name={sec.icon} size={16} /> {sec.label}
            </button>
          ))}
        </div>

        <div className="settings-main">
          <button className="settings-x" onClick={onClose}>
            <Icon name="close" size={18} />
          </button>
          {err && <p className="form-err">{err}</p>}
          {!s ? (
            <p className="dim">loading…</p>
          ) : section === "general" ? (
            <GeneralPane s={s} backends={backends} validAgents={validAgents} patch={patch} />
          ) : section === "environment" ? (
            <EnvPane />
          ) : section === "integrations" ? (
            <IntegrationsPane />
          ) : section === "memory" ? (
            <MemoryPane agents={agents} />
          ) : section === "usage" ? (
            <UsagePane />
          ) : section === "skills" ? (
            <SkillsPane />
          ) : section === "mcp" ? (
            <McpPane />
          ) : section === "databases" ? (
            <DatabasesPane />
          ) : section === "help" ? (
            <HelpPane />
          ) : (
            <CreditPane />
          )}
        </div>
      </div>
    </div>
  );
}

function GeneralPane({
  s,
  backends,
  validAgents,
  patch,
}: {
  s: Settings;
  backends: Backend[];
  validAgents: string[];
  patch: (p: Partial<Settings>) => void;
}) {
  const curBackend = backends.find((b) => b.id === s.default_backend) ?? backends[0];
  const curModel = s.default_model || curBackend?.models[0] || "";
  const EDIT = [
    { v: "on", t: "Ask me first (recommended)", d: "Agents can read, edit files and run commands — every action shows an Allow / Deny card." },
    { v: "auto", t: "Act freely in the project", d: "No prompts inside the project folder. Anything outside it still asks." },
    { v: "off", t: "Chat only", d: "No file or command access at all." },
  ];
  return (
    <div className="pane">
      <h3 className="pane-title">General</h3>

      <div className="setting-block">
        <div className="setting-label">Appearance</div>
        <div className="seg">
          {["dark", "light", "system"].map((a) => (
            <button key={a} className={s.appearance === a ? "on" : ""} onClick={() => patch({ appearance: a })}>
              {a[0].toUpperCase() + a.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <label className="setting-row">
        <span>
          <div className="setting-label">Spellchecker</div>
          <div className="setting-help">Underline misspellings in the message box.</div>
        </span>
        <input type="checkbox" className="toggle" checked={s.spellcheck} onChange={(e) => patch({ spellcheck: e.target.checked })} />
      </label>

      <label className="setting-row">
        <span>
          <div className="setting-label">Let OrkesAI learn from you</div>
          <div className="setting-help">
            Opt-in write-back memory: keeps a user profile (<code>PROFILE.md</code>), turns completed
            tool work into reusable skills (<code>skills/custom/auto-*</code>) attached to the @role that
            did it, and records corrections &amp; failures (<code>.learnings/</code>). Everything is a plain
            file in <code>~/.config/orkesai</code> you can open, edit or delete. Uses one cheap model
            call after each turn while on.
          </div>
        </span>
        <input type="checkbox" className="toggle" checked={s.learning} onChange={(e) => patch({ learning: e.target.checked })} />
      </label>

      <div className="setting-block">
        <div className="setting-label">New session with</div>
        <div className="two-col">
          <select
            value={curBackend?.id ?? "openrouter"}
            onChange={(e) => {
              const b = backends.find((x) => x.id === e.target.value);
              patch({ default_backend: e.target.value, default_model: b?.models[0] ?? "" });
            }}
          >
            {backends.map((b) => (
              <option key={b.id} value={b.id}>{b.label}</option>
            ))}
          </select>
          <select value={curModel} onChange={(e) => patch({ default_model: e.target.value })}>
            {(curBackend?.models ?? []).map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <div className="setting-help">
          The backend &amp; model a new default chat starts with. To start a chat with a team agent,
          use the “+” next to that @role in the sidebar instead.
        </div>
      </div>

      <div className="setting-block">
        <div className="setting-label">Default chat instructions</div>
        <textarea
          rows={4}
          placeholder="Custom system prompt for the default OrkesAI chat — e.g. tone, format, what to always do…"
          value={s.default_system ?? ""}
          onChange={(e) => patch({ default_system: e.target.value })}
        />
        <div className="setting-help">Applied to every default chat (not team @roles — those have their own instructions).</div>
      </div>

      <div className="setting-block">
        <div className="setting-label">What agents are allowed to do</div>
        <div className="radio-cards">
          {EDIT.map((o) => (
            <button key={o.v} className={`radio-card ${s.edit === o.v ? "sel" : ""}`} onClick={() => patch({ edit: o.v })}>
              <span className="rc-title">{o.t}</span>
              <span className="rc-desc">{o.d}</span>
            </button>
          ))}
        </div>
      </div>

      <label className="setting-row danger-zone">
        <span>
          <div className="setting-label">Full-disk access</div>
          <div className="setting-help">
            Let agents read, edit and create files <b>anywhere on your computer</b>, not just inside the
            project. Each action is still shown for approval, but a mistaken or malicious command could
            change or delete files outside your project. Leave off unless you understand the risk.
          </div>
        </span>
        <input type="checkbox" className="toggle" checked={s.full_disk} onChange={(e) => patch({ full_disk: e.target.checked })} />
      </label>

      <div className="setting-block">
        <div className="setting-label">Terminal startup backend</div>
        <select value={s.agent} onChange={(e) => patch({ agent: e.target.value })}>
          {validAgents.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <div className="setting-help">Which AI the terminal `ai` command starts with.</div>
      </div>
    </div>
  );
}

function EnvPane() {
  const [items, setItems] = useState<EnvItem[]>([]);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [reveal, setReveal] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const load = () =>
    getEnv()
      .then((e) => {
        setItems(e);
        setVals(Object.fromEntries(e.map((i) => [i.key, i.value])));
        setTouched(new Set());
      })
      .catch(() => setErr("cannot reach the server"));
  useEffect(() => { load(); }, []);

  async function save() {
    setErr(""); setMsg("");
    const patch: Record<string, string> = {};
    for (const k of touched) patch[k] = vals[k] ?? "";
    if (Object.keys(patch).length === 0) { setMsg("Nothing changed."); return; }
    try {
      const e = await saveEnv(patch);
      setItems(e);
      setVals(Object.fromEntries(e.map((i) => [i.key, i.value])));
      setTouched(new Set());
      setMsg("Saved — applied to the running server.");
    } catch (x) {
      setErr(x instanceof Error ? x.message : "could not save");
    }
  }

  return (
    <div className="pane">
      <h3 className="pane-title">Environment</h3>
      <p className="setting-help">
        Edit the keys in your <code>.env</code> without leaving the app. Changes apply to the running
        server immediately. Secrets are stored on your machine and never shown in full.
      </p>
      {items.map((it) => (
        <div className="setting-block" key={it.key}>
          <div className="setting-label">
            {it.label}
            <span className={`env-badge ${it.set ? "on" : "off"}`}>{it.set ? "set" : "not set"}</span>
          </div>
          <div className="env-row">
            <input
              type={it.secret && !reveal.has(it.key) ? "password" : "text"}
              value={vals[it.key] ?? ""}
              placeholder={it.secret ? "paste a new key to replace" : it.key}
              onChange={(e) => {
                setVals((v) => ({ ...v, [it.key]: e.target.value }));
                setTouched((t) => new Set(t).add(it.key));
              }}
            />
            {it.secret && (
              <button
                className="btn"
                type="button"
                onClick={() => setReveal((r) => { const n = new Set(r); n.has(it.key) ? n.delete(it.key) : n.add(it.key); return n; })}
              >
                {reveal.has(it.key) ? "Hide" : "Show"}
              </button>
            )}
          </div>
          <div className="setting-help">{it.help}</div>
        </div>
      ))}
      {err && <p className="form-err">{err}</p>}
      {msg && <p className="setting-help" style={{ color: "var(--accent)" }}>{msg}</p>}
      <div className="modal-actions">
        <span className="spacer" />
        <button className="btn primary" onClick={save} disabled={touched.size === 0}>Save changes</button>
      </div>
    </div>
  );
}

function IntegrationsPane() {
  const [items, setItems] = useState<Integration[]>([]);
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [auth, setAuth] = useState<"bearer" | "plain">("bearer");
  const [header, setHeader] = useState("Authorization");
  const [apiKey, setApiKey] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () => getIntegrations().then(setItems).catch(() => {});
  useEffect(() => { load(); }, []);

  async function add() {
    setErr(""); setBusy(true);
    try {
      await addIntegration({ name: name.trim(), base_url: baseUrl.trim(), auth, header: header.trim(), api_key: apiKey.trim() });
      setName(""); setBaseUrl(""); setApiKey(""); setHeader("Authorization"); setAuth("bearer");
      load();
    } catch (e) { setErr(e instanceof Error ? e.message : "failed"); }
    setBusy(false);
  }

  return (
    <div className="pane">
      <h3 className="pane-title">API integrations</h3>
      <p className="setting-help">
        Connect any OpenAI-compatible API endpoint (Groq, Together, Mistral, a company gateway…).
        It appears as its own backend in the engine picker, and its model list loads from the
        endpoint automatically.
      </p>
      <div className="setting-block">
        <div className="setting-label">Name</div>
        <input placeholder="e.g. Groq" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="setting-block">
        <div className="setting-label">Base URL</div>
        <input placeholder="https://api.groq.com/openai/v1" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
        <div className="setting-help">Root of the OpenAI-compatible API — /models and /chat/completions live under it.</div>
      </div>
      <div className="two-col">
        <div className="setting-block">
          <div className="setting-label">Auth</div>
          <select value={auth} onChange={(e) => setAuth(e.target.value as "bearer" | "plain")}>
            <option value="bearer">Bearer token</option>
            <option value="plain">Plain header value</option>
          </select>
        </div>
        <div className="setting-block">
          <div className="setting-label">Header</div>
          <input placeholder="Authorization" value={header} onChange={(e) => setHeader(e.target.value)} />
        </div>
      </div>
      <div className="setting-block">
        <div className="setting-label">API key</div>
        <input type="password" placeholder="paste the key (stored on your machine only)" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
      </div>
      {err && <p className="form-err">{err}</p>}
      <div className="modal-actions">
        <span className="spacer" />
        <button className="btn primary" onClick={add} disabled={busy || !name.trim() || !baseUrl.trim()}>
          <Icon name="plus" size={13} /> Add integration
        </button>
      </div>

      <div className="setting-label" style={{ marginTop: 18 }}>Connected</div>
      <div className="list">
        {items.map((it) => (
          <div className="list-item" key={it.id}>
            <span>
              <Icon name="link" size={14} /> {it.name}
              <span className="menu-sub mono">{it.base_url}</span>
              <span className={`env-badge ${it.api_key ? "on" : "off"}`}>{it.api_key ? `key ${it.api_key}` : "no key"}</span>
            </span>
            <button className="icon-del" onClick={async () => { await deleteIntegration(it.id); load(); }}>
              <Icon name="trash" size={15} />
            </button>
          </div>
        ))}
        {items.length === 0 && <p className="dim">No integrations yet.</p>}
      </div>
    </div>
  );
}


function MemoryPane({ agents }: { agents: Agent[] }) {
  const [items, setItems] = useState<MemoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [scope, setScope] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newScope, setNewScope] = useState("global");
  const [editing, setEditing] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [err, setErr] = useState("");

  const load = () =>
    getMemories({ q, scope })
      .then((r) => { setItems(r.memories); setTotal(r.stats.total); })
      .catch(() => setErr("cannot reach the server"));
  useEffect(() => { load(); }, [q, scope]); // eslint-disable-line react-hooks/exhaustive-deps

  async function add() {
    if (!newBody.trim()) return;
    setErr("");
    try { await addMemory({ body: newBody.trim(), scope: newScope, kind: "fact" }); setNewBody(""); load(); }
    catch (e) { setErr(e instanceof Error ? e.message : "failed"); }
  }

  return (
    <div className="pane">
      <h3 className="pane-title">Memory</h3>
      <p className="setting-help">
        The ONE shared brain — the GUI and the terminal read and write the same memories
        (<code>.memory.db</code>). Pinned memories ride along with every message; the rest are recalled
        when relevant. Everything here is yours: edit, pin, or delete any thought.
      </p>
      <div className="add-row">
        <input placeholder="Remember something… e.g. deploys happen from the VPS, never locally" value={newBody}
          onChange={(e) => setNewBody(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()} />
        <select value={newScope} onChange={(e) => setNewScope(e.target.value)} style={{ maxWidth: 150 }}>
          <option value="global">everywhere</option>
          {agents.map((a) => <option key={a.id} value={`role:${a.id}`}>@{a.id} only</option>)}
        </select>
        <button className="btn primary" onClick={add}>Remember</button>
      </div>
      <div className="add-row" style={{ marginTop: 8 }}>
        <input placeholder="Search memories…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={scope} onChange={(e) => setScope(e.target.value)} style={{ maxWidth: 150 }}>
          <option value="">all scopes</option>
          <option value="global">global</option>
          {agents.map((a) => <option key={a.id} value={`role:${a.id}`}>@{a.id}</option>)}
        </select>
      </div>
      {err && <p className="form-err">{err}</p>}
      <div className="list" style={{ marginTop: 10 }}>
        {items.map((m) => (
          <div className="db-item" key={m.id}>
            <div className="list-item">
              {editing === m.id ? (
                <span style={{ flex: 1, display: "flex", gap: 6 }}>
                  <input value={editBody} onChange={(e) => setEditBody(e.target.value)} autoFocus
                    onKeyDown={async (e) => {
                      if (e.key === "Enter" && editBody.trim()) { await updateMemory(m.id, { body: editBody.trim() }); setEditing(null); load(); }
                      if (e.key === "Escape") setEditing(null);
                    }} />
                  <button className="btn" onClick={async () => { if (editBody.trim()) { await updateMemory(m.id, { body: editBody.trim() }); } setEditing(null); load(); }}>Save</button>
                </span>
              ) : (
                <span style={{ flex: 1, minWidth: 0 }}>
                  {m.importance === "pinned" && <Icon name="spark" size={12} fill />}{" "}
                  <span className="menu-sub">[{m.kind}]</span> {m.body}
                  {m.scope !== "global" && <span className="menu-sub"> · {m.scope}</span>}
                </span>
              )}
              <span className="db-right">
                <button className="icon-del" title={m.importance === "pinned" ? "Unpin" : "Pin — always recalled"}
                  onClick={async () => { await updateMemory(m.id, { importance: m.importance === "pinned" ? "normal" : "pinned" }); load(); }}>
                  <Icon name="spark" size={14} fill={m.importance === "pinned"} />
                </button>
                <button className="icon-del" title="Edit" onClick={() => { setEditing(m.id); setEditBody(m.body); }}>
                  <Icon name="edit" size={14} />
                </button>
                <button className="icon-del" title="Forget" onClick={async () => { await deleteMemory(m.id); load(); }}>
                  <Icon name="trash" size={14} />
                </button>
              </span>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="dim">No memories{q || scope ? " match" : " yet — add one above, or enable learning and just chat"}.</p>}
      </div>
      <p className="setting-help" style={{ marginTop: 10 }}>{total} memories total · same brain as the terminal&apos;s <code>/mem</code>.</p>
    </div>
  );
}

function UsagePane() {
  const [range, setRange] = useState("month");
  const [u, setU] = useState<Usage | null>(null);
  useEffect(() => {
    getUsage(range).then(setU).catch(() => setU(null));
  }, [range]);
  const maxCost = u ? Math.max(...u.models.map((m) => m.cost), 0.0001) : 1;
  return (
    <div className="pane">
      <h3 className="pane-title">Usage</h3>
      <div className="seg">
        {["week", "month", "year", "all"].map((r) => (
          <button key={r} className={range === r ? "on" : ""} onClick={() => setRange(r)}>
            {r === "all" ? "All time" : r[0].toUpperCase() + r.slice(1)}
          </button>
        ))}
      </div>
      {!u ? (
        <p className="dim">loading…</p>
      ) : (
        <>
          <div className="stat-row">
            <div className="stat">
              <div className="stat-num">${u.total.cost.toFixed(4)}</div>
              <div className="stat-lbl">total spent</div>
            </div>
            <div className="stat">
              <div className="stat-num">{num(u.total.in + u.total.out)}</div>
              <div className="stat-lbl">tokens ({num(u.total.in)} in · {num(u.total.out)} out)</div>
            </div>
            <div className="stat">
              <div className="stat-num">{num(u.total.req)}</div>
              <div className="stat-lbl">requests</div>
            </div>
          </div>

          {u.balance && (
            <div className="balance-box">
              <div className="setting-label">OpenRouter balance</div>
              <div className="bal-bar">
                <div className="bal-fill" style={{ width: `${Math.min(100, (u.balance.used / (u.balance.total || 1)) * 100)}%` }} />
              </div>
              <div className="bal-legend">
                <span>used ${u.balance.used.toFixed(4)}</span>
                <span>${u.balance.left.toFixed(2)} left of ${u.balance.total.toFixed(2)}</span>
              </div>
            </div>
          )}

          <div className="setting-label" style={{ marginTop: 18 }}>By model</div>
          {u.models.length === 0 && <p className="dim">No usage in this period.</p>}
          {u.models.map((m) => (
            <div className="model-row" key={m.model}>
              <div className="model-line">
                <span className="model-name">{m.model}</span>
                <span className="model-cost">${m.cost.toFixed(4)}</span>
              </div>
              <div className="usage-bar">
                <div className="usage-fill" style={{ width: `${(m.cost / maxCost) * 100}%` }} />
              </div>
              <div className="model-sub">
                {num(m.in)} in · {num(m.out)} out · {num(m.req)} requests
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function SkillsPane() {
  const [skills, setSkills] = useState<{ name: string; category: string; ok?: boolean; detail?: string }[]>([]);
  const [name, setName] = useState("");
  const [source, setSource] = useState("");
  const [err, setErr] = useState("");
  const load = () => getSkills().then(setSkills).catch(() => {});
  useEffect(() => { load(); }, []);
  return (
    <div className="pane">
      <h3 className="pane-title">Skills</h3>
      <p className="setting-help">Prompt-skills attach extra instructions to agents. Add one from a GitHub repo (owner/repo) or a URL.</p>
      <div className="add-row">
        <input placeholder="name" value={name} onChange={(e) => setName(e.target.value)} style={{ maxWidth: 140 }} />
        <input placeholder="owner/repo or url" value={source} onChange={(e) => setSource(e.target.value)} />
        <button
          className="btn primary"
          onClick={async () => {
            setErr("");
            try { await addSkill(name.trim(), source.trim()); setName(""); setSource(""); load(); }
            catch (e) { setErr(e instanceof Error ? e.message : "failed"); }
          }}
        >
          Add
        </button>
      </div>
      {err && <p className="form-err">{err}</p>}
      <div className="list">
        {skills.map((sk) => (
          <div className="list-item" key={sk.category + sk.name}>
            <span>
              <Icon name="puzzle" size={14} /> {sk.name} <span className="menu-sub">{sk.category}</span>
              <span className={`env-badge ${sk.ok ? "on" : "off"}`} title={sk.detail}>{sk.ok ? "installed" : sk.detail || "problem"}</span>
            </span>
            <button className="icon-del" onClick={async () => { await removeSkill(sk.name); load(); }}>
              <Icon name="trash" size={15} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function McpPane() {
  const [servers, setServers] = useState<{ name: string; command: string; ok?: boolean; detail?: string }[]>([]);
  const [name, setName] = useState("");
  const [command, setCommand] = useState("");
  const [err, setErr] = useState("");
  const load = () => getMcp().then(setServers).catch(() => {});
  useEffect(() => { load(); }, []);
  return (
    <div className="pane">
      <h3 className="pane-title">MCP servers</h3>
      <p className="setting-help">Model Context Protocol servers give agents extra tools. Enter a shell command or an https URL.</p>
      <div className="add-row">
        <input placeholder="name" value={name} onChange={(e) => setName(e.target.value)} style={{ maxWidth: 140 }} />
        <input placeholder="npx -y @scope/server  ·  https://…" value={command} onChange={(e) => setCommand(e.target.value)} />
        <button
          className="btn primary"
          onClick={async () => {
            setErr("");
            try { await addMcp(name.trim(), command.trim()); setName(""); setCommand(""); load(); }
            catch (e) { setErr(e instanceof Error ? e.message : "failed"); }
          }}
        >
          Add
        </button>
      </div>
      {err && <p className="form-err">{err}</p>}
      <div className="list">
        {servers.map((sv) => (
          <div className="list-item" key={sv.name}>
            <span>
              <Icon name="plug" size={14} /> {sv.name} <span className="menu-sub mono">{sv.command}</span>
              <span className={`env-badge ${sv.ok ? "on" : "off"}`} title={sv.detail}>{sv.ok ? "ready" : sv.detail || "problem"}</span>
            </span>
            <button className="icon-del" onClick={async () => { await removeMcp(sv.name); load(); }}>
              <Icon name="trash" size={15} />
            </button>
          </div>
        ))}
        {servers.length === 0 && <p className="dim">No MCP servers configured.</p>}
      </div>
    </div>
  );
}

function DatabasesPane() {
  const [dbs, setDbs] = useState<{ name: string; size: number; tables: { table: string; rows: number }[]; kind?: string }[]>([]);
  const [err, setErr] = useState("");
  const load = () => getDatabases().then(setDbs).catch(() => {});
  useEffect(() => { load(); }, []);
  async function del(name: string) {
    if (!window.confirm(`Delete "${name}"? This permanently removes the store and its data to free disk space.`)) return;
    setErr("");
    try { await deleteDatabase(name); load(); }
    catch (e) { setErr(e instanceof Error ? e.message : "could not delete"); }
  }
  return (
    <div className="pane">
      <h3 className="pane-title">Databases</h3>
      <p className="setting-help">On-device SQLite stores — memory, history and the spend ledger. Everything stays on your machine. Delete a store to reclaim disk (it will be recreated empty when next needed).</p>
      {err && <p className="form-err">{err}</p>}
      <div className="list">
        {dbs.map((d) => (
          <div className="db-item" key={d.name}>
            <div className="list-item">
              <span><Icon name="database" size={14} /> {d.name}</span>
              <span className="db-right">
                <span className="menu-sub">{bytes(d.size)}</span>
                <button className="icon-del" title="Delete store" onClick={() => del(d.name)}>
                  <Icon name="trash" size={15} />
                </button>
              </span>
            </div>
            {d.tables.length > 0 && (
              <div className="db-tables">
                {d.tables.map((t) => (
                  <span key={t.table} className="db-table">{t.table}: {num(t.rows)}</span>
                ))}
              </div>
            )}
          </div>
        ))}
        {dbs.length === 0 && <p className="dim">No databases yet.</p>}
      </div>
    </div>
  );
}

function HelpPane() {
  const CMDS = [
    ["New chat", "Start a fresh conversation with the default agent"],
    ["@role message", "Ask a team agent, or reference their work for a handoff"],
    ["Projects", "Group chats, set instructions, and attach files"],
    ["/agent · /model", "Pick the backend and model from the composer"],
    ["Allow / Deny", "Approve each file edit or command an agent wants to run"],
  ];
  return (
    <div className="pane">
      <h3 className="pane-title">Help</h3>
      <div className="setting-block">
        <div className="setting-label">Docs</div>
        <a className="link-row" href="https://wibawasuyadnya.github.io/orkesai/" target="_blank" rel="noreferrer">
          <Icon name="book" size={15} /> wibawasuyadnya.github.io/orkesai
        </a>
      </div>
      <div className="setting-block">
        <div className="setting-label">What you can do</div>
        <div className="list">
          {CMDS.map(([c, d]) => (
            <div className="cmd-row" key={c}>
              <span className="cmd-name">{c}</span>
              <span className="cmd-desc">{d}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CreditPane() {
  return (
    <div className="pane">
      <h3 className="pane-title">Credit</h3>
      <a className="link-row" href="https://github.com/wibawasuyadnya/orkesai" target="_blank" rel="noreferrer">
        <Icon name="github" size={16} /> github.com/wibawasuyadnya/orkesai
      </a>
      <div className="credit-copy">
        <Icon name="heart" size={15} fill /> Managed by <b>suyadnya</b>
      </div>
      <p className="setting-help">OrkesAI — a local, multi-agent AI that runs on your own machine. MIT licensed.</p>
    </div>
  );
}
