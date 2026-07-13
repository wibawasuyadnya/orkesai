"use client";

import { useState } from "react";
import Icon from "./Icon";
import { Agent, Group, createGroup, deleteGroup, updateGroup } from "@/lib/api";

// Create / edit a group: a name, an emoji and the @role participants. Which
// roles join is entirely the user's pick — no role has to be in any group.
export default function GroupModal({
  group, agents, onClose, onChanged, onOpen,
}: {
  group: Group | null;
  agents: Agent[];
  onClose: () => void;
  onChanged: () => void;
  onOpen: (sessionId: string) => void;
}) {
  const [name, setName] = useState(group?.name ?? "");
  const [icon, setIcon] = useState(group?.icon ?? "👥");
  const [picked, setPicked] = useState<Set<string>>(new Set(group?.participants ?? []));
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  function toggle(id: string) {
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  async function save() {
    setErr(""); setBusy(true);
    try {
      const data = { name: name.trim(), icon, participants: [...picked] };
      if (group) {
        await updateGroup(group.id, data);
        onChanged();
        onClose();
      } else {
        const g = await createGroup(data);
        onChanged();
        onClose();
        onOpen(g.session); // jump straight into the new group's chat
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "could not save");
      setBusy(false);
    }
  }

  async function remove() {
    if (!group) return;
    if (!window.confirm(`Delete the "${group.name}" group and its conversation?`)) return;
    await deleteGroup(group.id);
    onChanged();
    onClose();
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head">
          <h2>{group ? `Edit ${group.name}` : "New group"}</h2>
          <button className="x" onClick={onClose}>✕</button>
        </div>

        <div className="row">
          <div className="field" style={{ width: 84 }}>
            <label>Icon</label>
            <input value={icon} onChange={(e) => setIcon(e.target.value)} style={{ textAlign: "center" }} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Group name</label>
            <input autoFocus value={name} placeholder="e.g. Product squad" onChange={(e) => setName(e.target.value)} />
          </div>
        </div>

        <div className="field">
          <label>Participants <span className="field-val">{picked.size} of {agents.length} @roles</span></label>
          {agents.length === 0 && (
            <p className="help">No team @roles yet — create some under “Team” in the sidebar first.</p>
          )}
          <div className="group-pick">
            {agents.map((a) => (
              <button
                key={a.id}
                className={`group-pick-item ${picked.has(a.id) ? "sel" : ""}`}
                onClick={() => toggle(a.id)}
              >
                <span className="role-emoji emoji-glyph">{a.icon}</span>
                <span className="gp-name">@{a.id}<span className="gp-sub">{a.name}</span></span>
                {picked.has(a.id) && <Icon name="check" size={14} />}
              </button>
            ))}
          </div>
          <p className="help">
            Every participant answers a plain message with its own part; mention <b>@role</b> in a
            message to address only that role (type @ in the group chat for the participant list).
          </p>
        </div>

        {err && <p className="form-err">{err}</p>}
        <div className="modal-actions">
          {group && (
            <button className="btn danger" onClick={remove} disabled={busy}>
              <Icon name="trash" size={13} /> Delete group
            </button>
          )}
          <span className="spacer" />
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={save} disabled={busy || !name.trim() || picked.size === 0}>
            {busy ? "Saving…" : group ? "Save" : "Create group"}
          </button>
        </div>
      </div>
    </div>
  );
}
