"use client";

import { useEffect, useState } from "react";
import { Agent, Backend, createAgent, deleteAgent, enhancePrompt, getBackends, getOpenrouterCatalog, updateAgent } from "@/lib/api";
import EmojiPicker from "./EmojiPicker";

const TEMP_STOPS = [
  { v: "precise", label: "Precise / code" },
  { v: "balanced", label: "Balanced" },
  { v: "creative", label: "Creative" },
];

const MODEL_VERSIONS: Record<string, string> = { opus: "4.8", sonnet: "5", haiku: "4.5" };

const MODEL_HINTS: Record<string, string> = {
  openrouter: "pay-per-token via your OpenRouter key",
  claude: "uses your Claude Code login",
  codex: "uses your ChatGPT login",
  local: "runs on the on-device llama-server · to use a different (e.g. lighter) local model, change the -hf line in start-local.sh — it downloads on the next start",
};

export default function AgentModal({
  agent,
  onClose,
  onChanged,
}: {
  agent: Agent | null; // null = create new
  onClose: () => void;
  onChanged: () => void;
}) {
  const [name, setName] = useState(agent?.name ?? "");
  const [icon, setIcon] = useState(agent?.icon ?? "🤖");
  const [backend, setBackend] = useState(agent?.backend ?? "openrouter");
  const [model, setModel] = useState(agent?.model ?? "");
  const [effort, setEffort] = useState(agent?.effort ?? "");
  // legacy ""/unset means balanced (the backend default) — the slider has no
  // separate "default" stop anymore
  const [temperature, setTemperature] = useState(agent?.temperature || "balanced");
  const [maxTokens, setMaxTokens] = useState(agent?.max_tokens ?? 0);
  const [system, setSystem] = useState(agent?.system ?? "");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [pickIcon, setPickIcon] = useState(false);
  const [backends, setBackends] = useState<Backend[]>([]);
  const [customModel, setCustomModel] = useState(false);
  // the full OpenRouter catalog (~345 models) feeds the model combobox
  const [catalog, setCatalog] = useState<string[]>([]);
  const [modelOpen, setModelOpen] = useState(false);
  useEffect(() => {
    getOpenrouterCatalog().then((c) => setCatalog(c.models.map((m) => m.id))).catch(() => {});
  }, []);
  const [enhanceWith, setEnhanceWith] = useState("deepseek/deepseek-v4-flash");
  const [enhancing, setEnhancing] = useState(false);
  const [beforeEnhance, setBeforeEnhance] = useState<string | null>(null);

  async function enhance() {
    if (!system.trim() || enhancing) return;
    setEnhancing(true);
    setErr("");
    try {
      const out = await enhancePrompt(system, name, enhanceWith);
      setBeforeEnhance(system); // keep the rough version for undo
      setSystem(out);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "could not enhance");
    }
    setEnhancing(false);
  }

  const modelsFor = (b: string, list = backends) =>
    list.find((x) => x.id === b)?.models ?? [];

  // combobox entries: shortlist first, then catalog matches for what's typed
  const comboQuery = model.trim().toLowerCase();
  const comboShort = modelsFor("openrouter").filter((m) => m.toLowerCase().includes(comboQuery));
  const comboOptions = [
    ...comboShort,
    ...catalog.filter((m) => m.toLowerCase().includes(comboQuery) && !comboShort.includes(m)).slice(0, 30),
  ];

  // Models come from the live /api/backends (same source as the composer), so
  // e.g. "local" always shows the model start-local.sh actually serves.
  useEffect(() => {
    getBackends()
      .then((bs) => {
        setBackends(bs);
        const b = agent?.backend ?? "openrouter";
        const list = modelsFor(b, bs);
        const m = agent?.model ?? "";
        if (!m) setModel(list[0] ?? "");
        // an existing model the list doesn't know: local auto-corrects to what
        // the llama-server serves; other backends keep it as a custom entry
        // (openrouter uses the searchable combobox, no custom mode needed)
        else if (!list.includes(m) && b !== "openrouter") {
          if (b === "local") setModel(list[0] ?? m);
          else setCustomModel(true);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pickBackend(b: NonNullable<Agent["backend"]>) {
    setBackend(b);
    setErr("");
    const list = modelsFor(b);
    // keep the model only if the new backend knows it — otherwise snap to that
    // backend's first model so the pair can never be invalid
    if (!list.includes(model)) {
      setModel(list[0] ?? "");
      setCustomModel(false);
    }
  }

  async function save() {
    setBusy(true);
    setErr("");
    try {
      const data = { name, icon, backend, model, system, effort, temperature, max_tokens: maxTokens } as Partial<Agent>;
      if (agent) await updateAgent(agent.id, data);
      else await createAgent(data);
      onChanged();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "could not save");
    }
    setBusy(false);
  }

  async function remove() {
    if (!agent) return;
    if (!window.confirm(`Delete the ${agent.name} agent? Its old chats stay on disk.`)) return;
    setBusy(true);
    try {
      await deleteAgent(agent.id);
      onChanged();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "could not delete");
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head">
          <h2>{agent ? `Edit ${agent.name}` : "New team agent"}</h2>
          <button className="x" onClick={onClose}>✕</button>
        </div>

        <div className="row">
          <div className="field" style={{ width: 84, position: "relative" }}>
            <label>Icon</label>
            <button
              type="button"
              className="emoji-swatch"
              // stop the picker's outside-click handler from firing on this same
              // mousedown (which would immediately reopen it)
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => setPickIcon((v) => !v)}
              title="Pick an emoji"
            >
              <span className="emoji-glyph">{icon || "🤖"}</span>
            </button>
            {pickIcon && (
              <EmojiPicker
                onPick={(e) => { setIcon(e); setPickIcon(false); }}
                onClose={() => setPickIcon(false)}
              />
            )}
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Name</label>
            <input
              value={name}
              placeholder="e.g. Researcher"
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        </div>

        <div className="row">
          <div className="field" style={{ flex: 1 }}>
            <label>Backend</label>
            <select
              value={backend}
              onChange={(e) => pickBackend(e.target.value as NonNullable<Agent["backend"]>)}
            >
              <option value="openrouter">OpenRouter (API key)</option>
              <option value="claude">Claude Code (subscription)</option>
              <option value="codex">Codex CLI (subscription)</option>
              <option value="local">Local model (on-device)</option>
              {backends.filter((b) => b.id.startsWith("api:")).map((b) => (
                <option key={b.id} value={b.id}>{b.label} (integration)</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ flex: 1.4, position: "relative" }}>
            <label>
              Model
              {backend === "openrouter" && catalog.length > 0 && (
                <span className="field-val">{catalog.length} available</span>
              )}
              {customModel && backend !== "openrouter" && (
                <span className="field-val" style={{ cursor: "pointer" }}
                  onClick={() => { setCustomModel(false); setModel(modelsFor(backend)[0] ?? ""); }}>
                  choose from list
                </span>
              )}
            </label>
            {backend === "openrouter" ? (
              // searchable combobox over the shortlist + the FULL catalog
              <>
                <input
                  value={model}
                  placeholder="type to search — e.g. z-ai/glm-5.2"
                  onFocus={() => setModelOpen(true)}
                  onBlur={() => setModelOpen(false)}
                  onChange={(e) => { setModel(e.target.value); setModelOpen(true); }}
                />
                {modelOpen && comboOptions.length > 0 && (
                  <div className="combo-list">
                    {comboOptions.map((m) => (
                      <button
                        key={m}
                        className={`combo-item ${m === model ? "sel" : ""}`}
                        // mousedown so the pick lands before the input's blur
                        onMouseDown={(e) => { e.preventDefault(); setModel(m); setModelOpen(false); }}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : customModel || backends.length === 0 || (backend.startsWith("api:") && modelsFor(backend).length === 0) ? (
              <input
                value={model}
                autoFocus
                placeholder="model id"
                onChange={(e) => setModel(e.target.value)}
              />
            ) : (
              <select
                value={model}
                onChange={(e) => {
                  if (e.target.value === "__custom__") { setCustomModel(true); setModel(""); }
                  else setModel(e.target.value);
                }}
              >
                {modelsFor(backend).map((m) => (
                  <option key={m} value={m}>
                    {m}{MODEL_VERSIONS[m] ? ` · v${MODEL_VERSIONS[m]}` : ""}
                  </option>
                ))}
                {/* local serves exactly what start-local.sh loads — no free-typing there */}
                {backend !== "local" && <option value="__custom__">Custom model…</option>}
              </select>
            )}
          </div>
          <div className="field" style={{ width: 110 }}>
            <label>Effort</label>
            <select value={effort} onChange={(e) => setEffort(e.target.value)}>
              <option value="">Default</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>
        <div className="row">
          <div className="field" style={{ flex: 1 }}>
            <label>Temperature <span className="field-val">{TEMP_STOPS.find((t) => t.v === temperature)?.label ?? "Balanced"}</span></label>
            <input className="slider" type="range" min={0} max={2} step={1}
              value={Math.max(0, TEMP_STOPS.findIndex((t) => t.v === temperature))}
              onChange={(e) => setTemperature(TEMP_STOPS[parseInt(e.target.value, 10)].v)} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Max tokens <span className="field-val">{Math.min(maxTokens, 5000).toLocaleString()}</span></label>
            <input className="slider" type="range" min={0} max={5000} step={250}
              value={Math.min(maxTokens, 5000)} onChange={(e) => setMaxTokens(parseInt(e.target.value, 10))} />
          </div>
        </div>
        <p className="help">{MODEL_HINTS[backend ?? "openrouter"]} · this backend, model &amp; effort apply to <b>every</b> chat with this @role.</p>

        <div className="field">
          <label>
            Role instructions (system prompt)
            {beforeEnhance !== null && (
              <span className="field-val" style={{ cursor: "pointer" }}
                onClick={() => { setSystem(beforeEnhance); setBeforeEnhance(null); }}>
                undo enhance
              </span>
            )}
          </label>
          <textarea
            rows={6}
            value={system}
            placeholder="Write it rough — e.g. 'you are artist you create image' — then let Enhance turn it into a full prompt…"
            onChange={(e) => setSystem(e.target.value)}
          />
          <div className="enhance-row">
            <button
              type="button"
              className="btn"
              disabled={enhancing || !system.trim()}
              title="Rewrite the rough description above into a structured role prompt"
              onClick={enhance}
            >
              {enhancing ? "Enhancing…" : "✨ Enhance with AI"}
            </button>
            <select
              value={enhanceWith}
              title="Model used to write the prompt (one small OpenRouter call)"
              onChange={(e) => setEnhanceWith(e.target.value)}
            >
              {(modelsFor("openrouter").length
                ? modelsFor("openrouter")
                : ["deepseek/deepseek-v4-flash"]).map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        {err && <p className="form-err">{err}</p>}
        <div className="modal-actions">
          {agent && (
            <button className="btn danger" disabled={busy} onClick={remove}>
              Delete agent
            </button>
          )}
          <span className="spacer" />
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy || !name.trim() || !model.trim()} onClick={save}>
            {busy ? "Saving…" : agent ? "Save changes" : "Add agent"}
          </button>
        </div>
      </div>
    </div>
  );
}
