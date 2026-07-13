"use client";

import { useMemo, useRef, useState } from "react";
import Icon from "./Icon";
import Composer from "./Composer";
import {
  Agent,
  Attachment,
  Backend,
  DEFAULT_AGENT,
  Project,
  SessionMeta,
  Settings,
  addProjectFile,
  createProject,
  deleteProject,
  deleteProjectFile,
  updateProject,
} from "@/lib/api";
import { fileToAttachment } from "@/lib/files";

type StartOpts = { backend?: string; model?: string; effort?: string; role?: string; temperature?: string; max_tokens?: number };

export default function ProjectsView({
  projects,
  sessions,
  agents,
  backends,
  settings,
  onRefresh,
  onOpenChat,
  onStartChat,
  onNewRole,
  askText,
}: {
  projects: Project[];
  sessions: SessionMeta[];
  agents: Agent[];
  backends: Backend[];
  settings: Settings;
  onRefresh: () => void;
  onOpenChat: (id: string) => void;
  onStartChat: (projectPath: string, firstMessage: string, atts: Attachment[], opts: StartOpts) => void;
  onNewRole: () => void;
  askText: (spec: { title: string; placeholder?: string; okLabel?: string }) => Promise<string | null>;
}) {
  const [openName, setOpenName] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const open = projects.find((p) => p.name === openName) ?? null;

  const filtered = useMemo(
    () =>
      projects.filter(
        (p) =>
          p.name.toLowerCase().includes(q.toLowerCase()) ||
          p.description.toLowerCase().includes(q.toLowerCase()),
      ),
    [projects, q],
  );

  if (open) {
    return (
      <ProjectDetail
        project={open}
        sessions={sessions.filter((s) => s.project === open.path)}
        agents={agents}
        backends={backends}
        settings={settings}
        onBack={() => setOpenName(null)}
        onRefresh={onRefresh}
        onRenamed={(newName) => { setOpenName(newName); onRefresh(); }}
        onDeleted={() => { setOpenName(null); onRefresh(); }}
        onOpenChat={onOpenChat}
        onStartChat={onStartChat}
        onNewRole={onNewRole}
        askText={askText}
      />
    );
  }

  async function newProject() {
    const name = await askText({ title: "New project", placeholder: "Project name", okLabel: "Create" });
    if (!name?.trim()) return;
    try {
      await createProject(name.trim());
      onRefresh();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "could not create");
    }
  }

  return (
    <div className="projects-page">
      <div className="projects-head">
        <h1>Projects</h1>
        <button className="btn primary" onClick={newProject}>
          <Icon name="plus" size={15} /> New project
        </button>
      </div>
      <div className="search-box">
        <Icon name="search" size={16} />
        <input placeholder="Search projects…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="project-grid">
        {filtered.map((p) => (
          <button className="project-card" key={p.name} onClick={() => setOpenName(p.name)}>
            <div className="pc-icon"><Icon name="folder" size={20} /></div>
            <div className="pc-title">{p.name}</div>
            <div className="pc-desc">{p.description || "No description yet."}</div>
            <div className="pc-foot">
              <span>{p.chats} {p.chats === 1 ? "chat" : "chats"}</span>
              {p.files.length > 0 && <span>{p.files.length} files</span>}
              {p.instructions && <span><Icon name="check" size={12} /> instructions</span>}
            </div>
          </button>
        ))}
        {filtered.length === 0 && <p className="dim">No projects{q ? " match your search" : " yet"}.</p>}
      </div>
    </div>
  );
}

function ProjectDetail({
  project,
  sessions,
  agents,
  backends,
  settings,
  onBack,
  onRefresh,
  onRenamed,
  onDeleted,
  onOpenChat,
  onStartChat,
  onNewRole,
  askText,
}: {
  project: Project;
  sessions: SessionMeta[];
  agents: Agent[];
  backends: Backend[];
  settings: Settings;
  onBack: () => void;
  onRefresh: () => void;
  onRenamed: (newName: string) => void;
  onDeleted: () => void;
  onOpenChat: (id: string) => void;
  onStartChat: (projectPath: string, firstMessage: string, atts: Attachment[], opts: StartOpts) => void;
  onNewRole: () => void;
  askText: (spec: { title: string; placeholder?: string; okLabel?: string }) => Promise<string | null>;
}) {
  const [name, setName] = useState(project.name);
  const [desc, setDesc] = useState(project.description);
  const [instr, setInstr] = useState(project.instructions);
  const [editMeta, setEditMeta] = useState(false);
  const [instrOpen, setInstrOpen] = useState(!!project.instructions);
  const fileRef = useRef<HTMLInputElement>(null);

  // its own composer state (a start-chat carries agent/model/effort into the new session)
  const [draft, setDraft] = useState("");
  const [atts, setAtts] = useState<Attachment[]>([]);
  const [backend, setBackend] = useState(settings.default_backend || "openrouter");
  const [model, setModel] = useState(
    settings.default_model || backends.find((b) => b.id === (settings.default_backend || "openrouter"))?.models[0] || "",
  );
  const [effort, setEffort] = useState("");
  const [temperature, setTemperature] = useState("");
  const [maxTokens, setMaxTokens] = useState(0);
  const [role, setRole] = useState(DEFAULT_AGENT);

  async function saveMeta() {
    try {
      if (name.trim() && name.trim() !== project.name) {
        const p = await updateProject(project.name, { name: name.trim(), description: desc });
        setEditMeta(false);
        onRenamed(p.name);
        return;
      }
      await updateProject(project.name, { description: desc });
      setEditMeta(false);
      onRefresh();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "could not save");
    }
  }

  function startChat() {
    if (!draft.trim() && atts.length === 0) return;
    const text = draft.trim();
    const sendAtts = atts;
    setDraft(""); setAtts([]);
    onStartChat(project.path, text, sendAtts, { backend, model, effort, role, temperature, max_tokens: maxTokens });
  }
  async function saveInstr() {
    await updateProject(project.name, { instructions: instr });
    onRefresh();
  }
  async function addFiles(files: FileList) {
    for (const f of Array.from(files)) {
      const att = await fileToAttachment(f);
      await addProjectFile(project.name, att);
    }
    onRefresh();
  }

  return (
    <div className="project-detail">
      <button className="back-btn" onClick={onBack}>
        <Icon name="chevron" size={14} className="flip" /> Projects
      </button>

      <div className="pd-head">
        <div className="pd-icon"><Icon name="folder" size={26} /></div>
        <div className="pd-titles">
          {editMeta ? (
            <>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Project name" style={{ fontWeight: 700 }} />
              <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Short description" />
              <div className="pd-meta-actions">
                <button className="btn" onClick={() => { setName(project.name); setDesc(project.description); setEditMeta(false); }}>Cancel</button>
                <button className="btn primary" onClick={saveMeta}>Save</button>
              </div>
            </>
          ) : (
            <>
              <h1>{project.name}</h1>
              <p className="pd-desc">{project.description || "No description yet."}</p>
            </>
          )}
        </div>
        {!editMeta && (
          <div className="pd-actions">
            <button className="icon-del" title="Edit" onClick={() => setEditMeta(true)}><Icon name="edit" size={16} /></button>
            <button
              className="icon-del"
              title="Delete project"
              onClick={async () => {
                if (window.confirm(`Delete project "${project.name}"? Chats are kept but detached.`)) {
                  await deleteProject(project.name);
                  onDeleted();
                }
              }}
            >
              <Icon name="trash" size={16} />
            </button>
          </div>
        )}
      </div>

      {/* start a chat — the same composer as the chat view (project is fixed) */}
      <Composer
        agents={agents}
        backends={backends}
        projects={[]}
        draft={draft}
        setDraft={setDraft}
        attachments={atts}
        setAttachments={setAtts}
        spellcheck={settings.spellcheck}
        streaming={false}
        backend={backend}
        model={model}
        effort={effort}
        temperature={temperature}
        maxTokens={maxTokens}
        role={role}
        project={project.path}
        locked={false}
        hideProject
        embedded
        onPickEngine={(b, m) => { setBackend(b); setModel(m); }}
        onPickEffort={setEffort}
        onPickTemp={setTemperature}
        onPickMaxTokens={setMaxTokens}
        onPickRole={setRole}
        onPickProject={() => {}}
        onNewProject={() => {}}
        onNewRole={onNewRole}
        onAddModel={() => {}}
        onSend={startChat}
        onStop={() => {}}
      />

      <div className="pd-cols">
        <div className="pd-col">
          <div className="pd-section-head">
            <span>Chats in this project</span>
          </div>
          {sessions.length === 0 ? (
            <p className="pd-empty">Start a chat to use this project.</p>
          ) : (
            <div className="list">
              {sessions.map((s) => (
                <button className="pd-chat" key={s.id} onClick={() => onOpenChat(s.id)}>
                  <Icon name="chat" size={14} />
                  <span className="pd-chat-title">{s.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="pd-col">
          <div className="pd-section-head">
            <span>Project instructions</span>
            {!instrOpen && (
              <button className="mini" onClick={() => setInstrOpen(true)}>
                <Icon name="plus" size={13} /> Set
              </button>
            )}
          </div>
          {instrOpen && (
            <div className="instr-box">
              <textarea
                rows={5}
                placeholder="Custom instructions applied to every chat in this project…"
                value={instr}
                onChange={(e) => setInstr(e.target.value)}
              />
              <button className="btn primary" onClick={saveInstr}>Save instructions</button>
            </div>
          )}

          <div className="pd-section-head" style={{ marginTop: 18 }}>
            <span>Files</span>
            <button className="mini" onClick={() => fileRef.current?.click()}>
              <Icon name="plus" size={13} /> Add
            </button>
            <input ref={fileRef} type="file" multiple hidden onChange={(e) => e.target.files && addFiles(e.target.files)} />
          </div>
          {project.files.length === 0 ? (
            <p className="pd-empty">No files attached.</p>
          ) : (
            <div className="list">
              {project.files.map((f) => (
                <div className="list-item" key={f}>
                  <span><Icon name="file" size={14} /> {f}</span>
                  <button className="icon-del" onClick={async () => { await deleteProjectFile(project.name, f); onRefresh(); }}>
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
