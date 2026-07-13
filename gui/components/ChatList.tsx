"use client";

import { useState } from "react";
import Icon from "./Icon";
import { Agent, DEFAULT_AGENT, SessionMeta } from "@/lib/api";

// Sidebar chat list. Default (non-role) chats sit flat at the top level; each
// team @role's chats collapse under an expandable header. Everything — loose
// chats and role groups alike — is ordered by latest activity, so whatever you
// touched most recently floats to the top.

type Entry =
  | { kind: "chat"; ts: number; session: SessionMeta }
  | { kind: "group"; ts: number; agent: Agent; sessions: SessionMeta[] };

export default function ChatList({
  agents,
  sessions,
  activeId,
  onOpen,
  onDelete,
  onNew,
  collapsed = false,
  onExpand,
}: {
  agents: Agent[];
  sessions: SessionMeta[];
  activeId: string | null;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: (roleId: string) => void;
  collapsed?: boolean;
  onExpand?: () => void;
}) {
  const [collapsedRoles, setCollapsedRoles] = useState<Set<string>>(new Set());
  const agentOf = (id: string) => agents.find((a) => a.id === id);

  const loose = sessions.filter((s) => s.agent === DEFAULT_AGENT || !agentOf(s.agent));
  const byRole = new Map<string, SessionMeta[]>();
  for (const s of sessions) {
    if (s.agent !== DEFAULT_AGENT && agentOf(s.agent)) {
      (byRole.get(s.agent) ?? byRole.set(s.agent, []).get(s.agent)!).push(s);
    }
  }

  const entries: Entry[] = [];
  for (const s of loose) entries.push({ kind: "chat", ts: s.updated, session: s });
  for (const [rid, list] of byRole) {
    const agent = agentOf(rid)!;
    list.sort((a, b) => b.updated - a.updated);
    entries.push({ kind: "group", ts: Math.max(...list.map((x) => x.updated)), agent, sessions: list });
  }
  entries.sort((a, b) => b.ts - a.ts);

  // Collapsed rail: default chats as bubble icons, each @role as its emoji with
  // a session count. Clicking a role expands the sidebar to reveal its chats.
  if (collapsed) {
    if (entries.length === 0) return null;
    return (
      <div className="chatlist-mini">
        {entries.map((e) =>
          e.kind === "chat" ? (
            <button
              key={e.session.id}
              className={`mini-chat ${activeId === e.session.id ? "active" : ""}`}
              title={e.session.title}
              onClick={() => onOpen(e.session.id)}
            >
              <Icon name="chat" size={16} />
            </button>
          ) : (
            <button
              key={e.agent.id}
              className={`mini-chat ${activeId && e.sessions.some((s) => s.id === activeId) ? "active" : ""}`}
              title={`@${e.agent.id} · ${e.sessions.length} chat${e.sessions.length === 1 ? "" : "s"}`}
              onClick={onExpand}
            >
              <span className="emoji-glyph mini-emoji">{e.agent.icon}</span>
              <span className="mini-badge">{e.sessions.length}</span>
            </button>
          ),
        )}
      </div>
    );
  }

  if (entries.length === 0) return <div className="side-empty">No chats yet</div>;

  return (
    <div className="chatlist">
      {entries.map((e) =>
        e.kind === "chat" ? (
          <ChatRow
            key={e.session.id}
            title={e.session.title}
            icon="chat"
            active={activeId === e.session.id}
            onOpen={() => onOpen(e.session.id)}
            onDelete={() => onDelete(e.session.id)}
          />
        ) : (
          <div className="role-group" key={e.agent.id}>
            <div className={`role-header ${activeId && e.sessions.some((s) => s.id === activeId) ? "has-active" : ""}`}>
              <button
                className="role-toggle"
                title={`@${e.agent.id} · ${e.sessions.length} chat${e.sessions.length === 1 ? "" : "s"}`}
                onClick={() => {
                  const next = new Set(collapsedRoles);
                  next.has(e.agent.id) ? next.delete(e.agent.id) : next.add(e.agent.id);
                  setCollapsedRoles(next);
                }}
              >
                <Icon name={collapsedRoles.has(e.agent.id) ? "chevron" : "chevronDown"} size={13} className="role-caret" />
                <span className="role-emoji emoji-glyph">{e.agent.icon}</span>
                {/* the @role owns this group; the sessions under it carry the summaries */}
                <span className="role-name">@{e.agent.id}</span>
                <span className="role-count">{e.sessions.length}</span>
              </button>
              <button className="role-add" title={`New chat with @${e.agent.id}`} onClick={() => onNew(e.agent.id)}>
                <Icon name="plus" size={13} />
              </button>
            </div>
            {!collapsedRoles.has(e.agent.id) &&
              e.sessions.map((s) => (
                <ChatRow
                  key={s.id}
                  title={s.title}
                  icon="chat"
                  nested
                  active={activeId === s.id}
                  onOpen={() => onOpen(s.id)}
                  onDelete={() => onDelete(s.id)}
                />
              ))}
          </div>
        ),
      )}
    </div>
  );
}

function ChatRow({
  title,
  icon,
  active,
  nested,
  onOpen,
  onDelete,
}: {
  title: string;
  icon: string;
  active: boolean;
  nested?: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={`chat-item ${active ? "active" : ""} ${nested ? "nested" : ""}`}>
      <button className="chat-open" onClick={onOpen} title={title}>
        <Icon name={icon} size={14} className="chat-icon" />
        <span className="chat-title">{title}</span>
      </button>
      <button
        className="chat-x"
        title="Delete chat"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      >
        <Icon name="trash" size={14} />
      </button>
    </div>
  );
}
