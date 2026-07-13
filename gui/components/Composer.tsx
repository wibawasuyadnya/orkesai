"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";
import { Agent, Attachment, Backend, DEFAULT_AGENT, Project } from "@/lib/api";
import { fileToAttachment } from "@/lib/files";
import { getOpenrouterCatalog } from "@/lib/api";

type Menu = null | "attach" | "project" | "role" | "engine" | "effort" | "tune";

// version hints for the Claude CLI aliases (they resolve to the latest release)
const MODEL_VERSIONS: Record<string, string> = { opus: "4.8", sonnet: "5", haiku: "4.5" };
const EFFORTS = [
  { v: "", label: "Default" },
  { v: "low", label: "Low" },
  { v: "medium", label: "Medium" },
  { v: "high", label: "High" },
];
const TEMPS = [
  { v: "precise", label: "Precise / code" },
  { v: "balanced", label: "Balanced" },
  { v: "creative", label: "Creative" },
];

export default function Composer({
  agents,
  backends,
  projects,
  draft,
  setDraft,
  attachments,
  setAttachments,
  spellcheck,
  streaming,
  // current selection (for a new chat) or the active session's settings
  backend,
  model,
  effort,
  temperature,
  maxTokens,
  role,
  project,
  locked, // active session: role is fixed, engine/project editable
  hideProject, // inside a project detail the folder picker is redundant
  embedded, // rendered in a page (not the bottom bar): full width + menus drop DOWN
  engineLocked, // role session: engine is canonical, set on the @role
  onEditRole,
  onPickEngine,
  onPickEffort,
  onPickTemp,
  onPickMaxTokens,
  onPickRole,
  onPickProject,
  onNewProject,
  onNewRole,
  onAddModel,
  onSend,
  onStop,
  groupMembers, // group chat: participants for the @mention sheet
}: {
  agents: Agent[];
  backends: Backend[];
  projects: Project[];
  draft: string;
  setDraft: (v: string) => void;
  attachments: Attachment[];
  setAttachments: (fn: (a: Attachment[]) => Attachment[]) => void;
  spellcheck: boolean;
  streaming: boolean;
  backend: string;
  model: string;
  effort: string;
  temperature: string;
  maxTokens: number;
  role: string;
  project: string;
  locked: boolean;
  hideProject?: boolean;
  embedded?: boolean;
  engineLocked?: boolean;
  onEditRole?: () => void;
  onPickEngine: (backend: string, model: string) => void;
  onPickEffort: (effort: string) => void;
  onPickTemp: (temp: string) => void;
  onPickMaxTokens: (n: number) => void;
  onPickRole: (roleId: string) => void;
  onPickProject: (path: string) => void;
  onNewProject: () => void;
  onNewRole: () => void;
  onAddModel: (backend: string) => void;
  onSend: () => void;
  onStop: () => void;
  groupMembers?: Agent[];
}) {
  const [menu, setMenu] = useState<Menu>(null);
  // group chat: typing "@" opens a sheet of participants; the current "@word"
  // being typed filters it
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);
  // full OpenRouter catalog for the model column's search box (lazy-loaded
  // the first time the engine menu opens on the openrouter backend)
  const [catalog, setCatalog] = useState<string[]>([]);
  const [modelQuery, setModelQuery] = useState("");
  const [engineBackend, setEngineBackend] = useState<string>(backend || "openrouter");
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) setMenu(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  async function addFiles(files: FileList | File[]) {
    const list = await Promise.all(Array.from(files).map(fileToAttachment));
    setAttachments((a) => [...a, ...list].slice(0, 8));
  }

  const roleAgent = agents.find((a) => a.id === role);
  const projName = projects.find((p) => p.path === project)?.name;
  const engineLabel = backends.find((b) => b.id === backend)?.label ?? backend;

  useEffect(() => {
    if (menu === "engine" && engineBackend === "openrouter" && catalog.length === 0) {
      getOpenrouterCatalog().then((c) => setCatalog(c.models.map((m) => m.id))).catch(() => {});
    }
  }, [menu, engineBackend, catalog.length]);

  // model column entries: the configured shortlist, then catalog search hits
  const configured = backends.find((b) => b.id === engineBackend)?.models ?? [];
  const q = modelQuery.trim().toLowerCase();
  const searchHits = engineBackend === "openrouter" && q
    ? catalog.filter((m) => m.toLowerCase().includes(q) && !configured.includes(m)).slice(0, 30)
    : [];
  const shownModels = q ? configured.filter((m) => m.toLowerCase().includes(q)) : configured;

  // ── @mention autocomplete (group chats only) ──
  function detectMention(text: string, caret: number) {
    if (!groupMembers?.length) return;
    const upto = text.slice(0, caret);
    const m = /(^|\s)@([A-Za-z0-9_-]*)$/.exec(upto);
    setMention(m ? { start: caret - m[2].length - 1, query: m[2].toLowerCase() } : null);
  }
  const mentionMatches = mention && groupMembers
    ? groupMembers.filter((a) =>
        a.id.toLowerCase().startsWith(mention.query) || a.name.toLowerCase().startsWith(mention.query))
    : [];
  function pickMention(id: string) {
    if (!mention) return;
    const el = inputRef.current;
    const caret = el?.selectionStart ?? draft.length;
    const next = draft.slice(0, mention.start) + "@" + id + " " + draft.slice(caret);
    setDraft(next);
    setMention(null);
    requestAnimationFrame(() => {
      el?.focus();
      const pos = mention.start + id.length + 2;
      el?.setSelectionRange(pos, pos);
    });
  }

  return (
    <div className={`composer-wrap ${embedded ? "embedded" : ""}`}>
      {attachments.length > 0 && (
        <div className="previews">
          {attachments.map((a, i) => (
            <span className="preview" key={i}>
              {a.type.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.url} alt={a.name} />
              ) : (
                <span className="file-chip-lg">
                  <Icon name="file" size={14} /> {a.name}
                </span>
              )}
              <button onClick={() => setAttachments((x) => x.filter((_, j) => j !== i))}>
                <Icon name="close" size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="composer" ref={barRef}>
        {/* text on top */}
        <textarea
          ref={inputRef}
          rows={1}
          className="composer-text"
          placeholder={`Message ${roleAgent ? roleAgent.name : "OrkesAI"}…`}
          value={draft}
          spellCheck={spellcheck}
          autoCorrect={spellcheck ? "on" : "off"}
          onChange={(e) => {
            setDraft(e.target.value);
            detectMention(e.target.value, e.target.selectionStart ?? e.target.value.length);
            e.target.style.height = "auto";
            e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px";
          }}
          onPaste={(e) => {
            const files = Array.from(e.clipboardData.files);
            if (files.length) {
              e.preventDefault();
              addFiles(files);
              return;
            }
            // Big paste (long doc / code) → attach as a .md file instead of
            // dumping it inline. Markdown attachments cost far fewer tokens than
            // pasted-then-resent text, and keep the composer readable.
            const text = e.clipboardData.getData("text");
            if (text.length > 1800 || text.split("\n").length > 40) {
              e.preventDefault();
              const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
              const name = `pasted-${stamp}.md`;
              setAttachments((a) => [
                ...a,
                { name, type: "text/markdown", url: `data:text/markdown;base64,${btoa(unescape(encodeURIComponent(text)))}` },
              ].slice(0, 8));
            }
          }}
          onKeyDown={(e) => {
            if (mention && mentionMatches.length && (e.key === "Enter" || e.key === "Tab")) {
              e.preventDefault();
              pickMention(mentionMatches[0].id);
              return;
            }
            if (e.key === "Escape" && mention) { setMention(null); return; }
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          onKeyUp={(e) => {
            const el = e.target as HTMLTextAreaElement;
            detectMention(el.value, el.selectionStart ?? el.value.length);
          }}
          onClick={(e) => {
            const el = e.target as HTMLTextAreaElement;
            detectMention(el.value, el.selectionStart ?? el.value.length);
          }}
        />

        {/* @mention sheet — participants of this group */}
        {mention && mentionMatches.length > 0 && (
          <div className="mention-sheet">
            {mentionMatches.map((a) => (
              <button key={a.id} className="mention-item" onMouseDown={(e) => { e.preventDefault(); pickMention(a.id); }}>
                <span className="role-emoji emoji-glyph">{a.icon}</span>
                <b>@{a.id}</b>
                <span className="mention-name">{a.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* toolbar below */}
        <div className="composer-bar">
          <input
            ref={fileRef}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <button className="tool" title="Attach a file" onClick={() => fileRef.current?.click()}>
            <Icon name="paperclip" size={17} />
          </button>

          {/* project */}
          {!hideProject && (
          <div className="tool-wrap">
            <button
              className={`tool ${project ? "on" : ""}`}
              title="Project"
              onClick={() => setMenu(menu === "project" ? null : "project")}
            >
              <Icon name="folder" size={17} />
              {projName && <span className="tool-label">{projName}</span>}
            </button>
            {menu === "project" && (
              <div className={`menu ${embedded ? "down" : "up"}`}>
                <div className="menu-head">Work inside a project</div>
                <button className={`menu-item ${!project ? "sel" : ""}`} onClick={() => { onPickProject(""); setMenu(null); }}>
                  No project
                </button>
                {projects.map((p) => (
                  <button
                    key={p.path}
                    className={`menu-item ${project === p.path ? "sel" : ""}`}
                    onClick={() => { onPickProject(p.path); setMenu(null); }}
                  >
                    <Icon name="folder" size={14} /> {p.name}
                  </button>
                ))}
                <button className="menu-item add" onClick={() => { onNewProject(); setMenu(null); }}>
                  <Icon name="plus" size={14} /> New project…
                </button>
              </div>
            )}
          </div>
          )}

          {/* role delegate — shown whenever the current chat is the default
              agent (new chat or a default session); hidden once a chat is
              already bound to a specific @role, and in GROUP chats (mention
              @roles in the message instead — no handoff there) */}
          {role === DEFAULT_AGENT && !groupMembers && (
            <div className="tool-wrap">
              <button
                className={`tool ${role !== DEFAULT_AGENT ? "on" : ""}`}
                title={locked ? "Hand this chat off to a teammate" : "Delegate to a team agent"}
                onClick={() => setMenu(menu === "role" ? null : "role")}
              >
                <Icon name="bot" size={17} />
                {roleAgent && <span className="tool-label">{roleAgent.name}</span>}
              </button>
              {menu === "role" && (
                <div className={`menu ${embedded ? "down" : "up"}`}>
                  <div className="menu-head">{locked ? "Hand this chat off to" : "Who should answer"}</div>
                  {!locked && (
                    <button className={`menu-item ${role === DEFAULT_AGENT ? "sel" : ""}`} onClick={() => { onPickRole(DEFAULT_AGENT); setMenu(null); }}>
                      <Icon name="spark" size={14} /> OrkesAI (default)
                    </button>
                  )}
                  {agents.map((a) => (
                    <button
                      key={a.id}
                      className={`menu-item ${role === a.id ? "sel" : ""}`}
                      onClick={() => { onPickRole(a.id); setMenu(null); }}
                    >
                      <Icon name="bot" size={14} /> {a.name}
                      <span className="menu-sub">{a.model.split("/").pop()}</span>
                    </button>
                  ))}
                  <button className="menu-item add" onClick={() => { onNewRole(); setMenu(null); }}>
                    <Icon name="plus" size={14} /> New team agent…
                  </button>
                </div>
              )}
            </div>
          )}

          <span className="bar-spacer" />

          {/* group chat: each @role answers on its own engine — no engine or
              tune pickers here, the composer keeps only attach + project */}
          {groupMembers ? null : engineLocked ? (
            <button
              className="engine-btn locked"
              title="This @role's engine — click to edit the role (applies to all its chats)"
              onClick={onEditRole}
            >
              <span className="engine-dot" /> {engineLabel} · {model.split("/").pop() || "model"}
              <span className="engine-eff">· {EFFORTS.find((e) => e.v === effort)?.label ?? "Default"}</span>
              <Icon name="edit" size={12} />
            </button>
          ) : (
          <div className="tool-wrap">
            <button
              className="engine-btn"
              title="Agent · model · effort"
              onClick={() => {
                if (menu !== "engine") setEngineBackend(backend || "openrouter");
                setMenu(menu === "engine" ? null : "engine");
              }}
            >
              <span className="engine-dot" /> {engineLabel} · {model.split("/").pop() || "model"}
              <span className="engine-eff">· {EFFORTS.find((e) => e.v === effort)?.label ?? "Default"}</span>
              <Icon name="chevronDown" size={13} />
            </button>
            {menu === "engine" && (
              <div className={`menu ${embedded ? "down" : "up"} right cascade tri`}>
                <div className="cascade-cols">
                  <div className="cascade-col">
                    <div className="menu-head">Agent</div>
                    {backends.map((b) => (
                      <button
                        key={b.id}
                        className={`menu-item ${engineBackend === b.id ? "sel" : ""}`}
                        onClick={() => setEngineBackend(b.id)}
                      >
                        {b.label}
                        {!b.available && <span className="menu-sub warn">setup</span>}
                        <Icon name="chevron" size={13} />
                      </button>
                    ))}
                  </div>
                  <div className="cascade-col models">
                    <div className="menu-head">Model</div>
                    {engineBackend === "openrouter" && (
                      <input
                        className="model-search"
                        placeholder={catalog.length ? `Search ${catalog.length} models…` : "Search models…"}
                        value={modelQuery}
                        onChange={(e) => setModelQuery(e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()}
                      />
                    )}
                    {shownModels.map((m) => (
                      <button
                        key={m}
                        className={`menu-item ${backend === engineBackend && model === m ? "sel" : ""}`}
                        onClick={() => { onPickEngine(engineBackend, m); setModelQuery(""); setMenu(null); }}
                      >
                        {m}
                        {MODEL_VERSIONS[m] && <span className="menu-sub">v{MODEL_VERSIONS[m]}</span>}
                      </button>
                    ))}
                    {searchHits.length > 0 && <div className="menu-head">From openrouter.ai</div>}
                    {searchHits.map((m) => (
                      <button
                        key={m}
                        className={`menu-item ${backend === engineBackend && model === m ? "sel" : ""}`}
                        onClick={() => { onPickEngine(engineBackend, m); setModelQuery(""); setMenu(null); }}
                      >
                        {m}
                      </button>
                    ))}
                    {engineBackend !== "openrouter" && (
                      <button className="menu-item add" onClick={() => { onAddModel(engineBackend); setMenu(null); }}>
                        <Icon name="plus" size={13} /> Add model…
                      </button>
                    )}
                  </div>
                  <div className="cascade-col effort">
                    <div className="menu-head">Effort</div>
                    {EFFORTS.map((e) => (
                      <button
                        key={e.v || "default"}
                        className={`menu-item ${effort === e.v ? "sel" : ""}`}
                        onClick={() => onPickEffort(e.v)}
                      >
                        {e.label}
                        {effort === e.v && <Icon name="check" size={13} />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
          )}

          {/* temperature + max tokens (default chat only; @roles set these in
              their edit popup) — sliders behind a performance-meter icon */}
          {!engineLocked && !groupMembers && (
            <div className="tool-wrap">
              <button className="engine-btn" title="Temperature &amp; max tokens" onClick={() => setMenu(menu === "tune" ? null : "tune")}>
                <Icon name="gauge" size={15} />
                <Icon name="chevronDown" size={13} />
              </button>
              {menu === "tune" && (
                <div className={`menu ${embedded ? "down" : "up"} right tune-menu`}>
                  <div className="tune-row">
                    {/* legacy ""/unset renders as balanced — that's what the backend runs */}
                    <div className="tune-label">Temperature <b>{TEMPS.find((t) => t.v === (temperature || "balanced"))?.label ?? "Balanced"}</b></div>
                    <input
                      className="slider" type="range" min={0} max={2} step={1}
                      value={Math.max(0, TEMPS.findIndex((t) => t.v === (temperature || "balanced")))}
                      onChange={(e) => onPickTemp(TEMPS[parseInt(e.target.value, 10)].v)}
                    />
                    <div className="slider-ticks"><span>Precise</span><span>Balanced</span><span>Creative</span></div>
                  </div>
                  <div className="tune-row">
                    <div className="tune-label">Max tokens <b>{Math.min(maxTokens, 5000).toLocaleString()}</b></div>
                    <input
                      className="slider" type="range" min={0} max={5000} step={250}
                      value={Math.min(maxTokens, 5000)}
                      onChange={(e) => onPickMaxTokens(parseInt(e.target.value, 10))}
                    />
                    <div className="slider-ticks"><span>0</span><span>5,000</span></div>
                  </div>
                </div>
              )}
            </div>
          )}

          {streaming ? (
            <button className="send stop" title="Stop generating" onClick={onStop}>
              <Icon name="stop" size={15} fill />
            </button>
          ) : (
            <button
              className="send"
              disabled={!draft.trim() && attachments.length === 0}
              title="Send (Enter)"
              onClick={onSend}
            >
              <Icon name="send2" size={17} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
