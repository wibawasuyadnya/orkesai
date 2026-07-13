"use client";

import { useCallback, useEffect, useState } from "react";
import Icon from "./Icon";
import {
  AgentFile, ContextData, CtxLink, Note, NOTE_EXPORT_FORMATS, NoteExportFormat,
  addLink, createNote, deleteLink, deleteNote, exportNotes, getContext, setNotesAuto, summarizeNote, updateNote,
} from "@/lib/api";
import { downloadImage } from "@/lib/files";

type Tab = "files" | "notes" | "links";

// The chat's collapsible right panel: Files, Notes and Links for the
// conversation. Scope follows the @role (shared across its chats) or, for a
// default chat, this one conversation.
export default function FilesPanel({
  agent,
  session,
  agentLabel,
  reloadKey,
  onOpenSession,
}: {
  agent: string;
  session: string;
  agentLabel: string; // "this chat" | "@advisor chats"
  reloadKey: number;
  onOpenSession: (id: string) => void;
}) {
  const [view, setView] = useState<"home" | Tab>("home");
  const [ctx, setCtx] = useState<ContextData | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setCtx(await getContext(agent, session)); } catch { setCtx(null); }
  }, [agent, session]);
  useEffect(() => { load(); }, [load, reloadKey]);

  const scope = ctx?.scope ?? "";

  const sections: { t: Tab; ic: string; label: string; count: number }[] = ctx
    ? [
        { t: "files", ic: "folder", label: "Files", count: ctx.files.length },
        { t: "notes", ic: "note", label: "Notes", count: ctx.notes.length },
        { t: "links", ic: "link", label: "Links", count: ctx.links.length },
      ]
    : [];
  const cur = sections.find((s) => s.t === view);

  return (
    <aside className="files-panel">
      <div className="files-head">
        {view === "home" ? (
          <span className="files-title">Context</span>
        ) : (
          <button className="files-back" onClick={() => setView("home")}>
            <Icon name="chevron" size={15} className="flip" /> {cur?.label}
            <span className="ctx-count">{cur?.count}</span>
          </button>
        )}
      </div>
      <div className="files-scroll">
        {!ctx ? (
          <p className="files-empty">Loading…</p>
        ) : view === "home" ? (
          <div className="ctx-nav">
            {sections.map(({ t, ic, label, count }) => (
              <button key={t} className="ctx-navitem" onClick={() => setView(t)}>
                <Icon name={ic} size={16} />
                <span className="ctx-navlabel">{label}</span>
                <span className="ctx-count">{count}</span>
                <Icon name="chevron" size={14} className="ctx-nav-caret" />
              </button>
            ))}
          </div>
        ) : view === "files" ? (
          <FilesTab ctx={ctx} activeSession={session} agentLabel={agentLabel} onOpenSession={onOpenSession} />
        ) : view === "notes" ? (
          <NotesTab ctx={ctx} scope={scope} agent={agent} session={session} busy={busy} setBusy={setBusy} reload={load} />
        ) : (
          <LinksTab ctx={ctx} scope={scope} reload={load} />
        )}
      </div>
    </aside>
  );
}

// ── Files ────────────────────────────────────────────────────────────────────
function FilesTab({ ctx, activeSession, agentLabel, onOpenSession }: {
  ctx: ContextData; activeSession: string; agentLabel: string; onOpenSession: (id: string) => void;
}) {
  const here = ctx.files.filter((f) => f.session === activeSession);
  const others = ctx.files.filter((f) => f.session !== activeSession);
  if (ctx.files.length === 0) return <p className="files-empty">No files in {agentLabel} yet.</p>;
  return (
    <>
      {here.length > 0 && (
        <>
          <div className="files-section">In this chat</div>
          <div className="files-grid">{here.map((f, i) => <FileTile key={"h" + i} f={f} onOpen={() => onOpenSession(f.session)} isHere />)}</div>
        </>
      )}
      {others.length > 0 && (
        <>
          <div className="files-section">From other {agentLabel}</div>
          <div className="files-grid">{others.map((f, i) => <FileTile key={"o" + i} f={f} onOpen={() => onOpenSession(f.session)} />)}</div>
        </>
      )}
    </>
  );
}

function FileTile({ f, onOpen, isHere }: { f: AgentFile; onOpen: () => void; isHere?: boolean }) {
  return (
    <div className="file-tile" title={`${f.name || "image"} · ${f.title}`}>
      <button className="file-open" onClick={onOpen}>
        {f.kind === "image" && f.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={f.url} alt={f.name || "image"} className="file-thumb" />
        ) : (
          <span className="file-doc"><Icon name="file" size={22} /></span>
        )}
        <span className="file-meta">
          <span className="file-name">{f.kind === "image" ? (f.generated ? "AI image" : "image") : f.name}</span>
          {!isHere && <span className="file-from">{f.title}</span>}
        </span>
      </button>
      {f.generated && <span className="file-badge">AI</span>}
      {f.kind === "image" && f.url && (
        <button className="file-dl" title="Download image" onClick={(e) => { e.stopPropagation(); downloadImage(f.url!, `orkesai-${f.session}`); }}>
          <Icon name="download" size={14} />
        </button>
      )}
    </div>
  );
}

// ── Notes ────────────────────────────────────────────────────────────────────
function NotesTab({ ctx, scope, agent, session, busy, setBusy, reload }: {
  ctx: ContextData; scope: string; agent: string; session: string;
  busy: boolean; setBusy: (b: boolean) => void; reload: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<Note | "new" | null>(null);
  const [err, setErr] = useState("");

  async function summarize() {
    setBusy(true); setErr("");
    try { await summarizeNote(agent, session); await reload(); }
    catch (e) { setErr(e instanceof Error ? e.message : "failed"); }
    setBusy(false);
  }

  return (
    <>
      <label className="ctx-toggle">
        <span>
          <b>Let the AI keep notes</b>
          <span className="ctx-help">When on, the AI saves the useful content from your chat as a note after each turn (extra tokens). Off = you write notes yourself and the AI is blocked from saving notes anywhere (it will tell you to turn this on). The AI can always READ notes but never edits yours.</span>
        </span>
        <input type="checkbox" className="toggle" checked={ctx.ai_auto}
          onChange={async (e) => { await setNotesAuto(scope, e.target.checked); reload(); }} />
      </label>
      <div className="ctx-actions col">
        <button className="btn" onClick={summarize} disabled={busy}>
          <Icon name="spark" size={13} fill /> {busy ? "Summarizing…" : "Summarize this chat"}
        </button>
        <button className="btn" onClick={() => setEditing("new")}><Icon name="plus" size={13} /> New note</button>
      </div>
      {err && <p className="form-err">{err}</p>}
      {ctx.notes.length === 0 && <p className="files-empty">No notes yet.</p>}
      {ctx.notes.map((n) => (
        <NoteCard key={n.id} n={n} scope={scope} onEdit={() => setEditing(n)} reload={reload} />
      ))}
      {editing && (
        <NotePopup
          note={editing === "new" ? null : editing}
          scope={scope}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); }}
        />
      )}
    </>
  );
}

function NoteCard({ n, scope, onEdit, reload }: {
  n: Note; scope: string; onEdit: () => void; reload: () => void;
}) {
  return (
    <div className="note-card">
      <div className="note-head">
        <span className="note-title">{n.title}</span>
        {n.source !== "manual" && <span className="note-badge">AI</span>}
        <span className="note-actions">
          <button title="Edit" onClick={onEdit}><Icon name="edit" size={13} /></button>
          <button title="Delete" onClick={async () => { await deleteNote(scope, n.id); reload(); }}><Icon name="trash" size={13} /></button>
        </span>
      </div>
      <div className="note-body">{n.body}</div>
    </div>
  );
}

function NotePopup({ note, scope, onClose, onSaved }: {
  note: Note | null; scope: string; onClose: () => void; onSaved: () => void;
}) {
  const [title, setTitle] = useState(note?.title ?? "");
  const [body, setBody] = useState(note?.body ?? "");
  const [busy, setBusy] = useState(false);
  const [expErr, setExpErr] = useState("");
  async function save() {
    if (!title.trim() && !body.trim()) return;
    setBusy(true);
    try {
      if (note) await updateNote(scope, note.id, { title: title.trim() || "Note", body: body.trim() });
      else await createNote(scope, title.trim() || "Note", body.trim());
      onSaved();
    } catch { setBusy(false); }
  }
  async function doExport(fmt: NoteExportFormat) {
    if (!note) return;
    setBusy(true); setExpErr("");
    try { await exportNotes(scope, fmt, note.id); }
    catch (e) { setExpErr(e instanceof Error ? e.message : "export failed"); }
    setBusy(false);
  }
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal note-modal">
        <div className="modal-head">
          <h2>{note ? "Edit note" : "New note"}</h2>
          <button className="x" onClick={onClose}>✕</button>
        </div>
        <div className="field">
          <label>Title</label>
          <input autoFocus value={title} placeholder="Note title" onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field">
          <label>Note</label>
          <textarea rows={12} value={body} placeholder="Write your note…" onChange={(e) => setBody(e.target.value)} />
        </div>
        {note && (
          <div className="field">
            <label>Export this note</label>
            <div className="ctx-actions" style={{ flexWrap: "wrap" }}>
              {NOTE_EXPORT_FORMATS.map((f) => (
                <button key={f} className="btn" disabled={busy} title={`Download this note as .${f}`}
                  onClick={() => doExport(f)}>
                  <Icon name="download" size={12} /> {f.toUpperCase()}
                </button>
              ))}
            </div>
            {expErr && <p className="form-err">{expErr}</p>}
          </div>
        )}
        <div className="modal-actions">
          <span className="spacer" />
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save note"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Links ────────────────────────────────────────────────────────────────────
function LinksTab({ ctx, scope, reload }: { ctx: ContextData; scope: string; reload: () => void }) {
  const [url, setUrl] = useState("");
  return (
    <>
      <div className="add-row">
        <input placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
        <button className="btn primary" onClick={async () => { if (url.trim()) { await addLink(scope, url.trim(), ""); setUrl(""); reload(); } }}>Add</button>
      </div>
      {ctx.links.length === 0 && <p className="files-empty">No links yet — ones shared in the chat show up here automatically.</p>}
      <div className="list" style={{ marginTop: 8 }}>
        {ctx.links.map((l: CtxLink, i) => (
          <div className="link-item" key={l.id ?? "auto" + i}>
            <a className="link-a" href={l.url} target="_blank" rel="noreferrer" title={l.url}>
              <Icon name="book" size={13} /> <span className="link-txt">{l.title || l.url.replace(/^https?:\/\//, "")}</span>
            </a>
            {l.source === "chat"
              ? <span className="link-src">chat</span>
              : <button className="icon-del" onClick={async () => { if (l.id) { await deleteLink(scope, l.id); reload(); } }}><Icon name="trash" size={13} /></button>}
          </div>
        ))}
      </div>
    </>
  );
}
