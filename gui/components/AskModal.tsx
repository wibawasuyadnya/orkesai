"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";

// Electron's Chromium build does NOT implement window.prompt() — it throws and
// returns null, which broke "edit & resend", "new project" and "add model".
// This is a small in-app replacement used through the askText() helper.

export interface AskSpec {
  title: string;
  placeholder?: string;
  initial?: string;
  okLabel?: string;
  multiline?: boolean;
  suggestions?: string[]; // datalist autocomplete for the single-line input
  hint?: string; // small line under the input (e.g. "345 models loaded")
  resolve: (value: string | null) => void;
}

export default function AskModal({ spec }: { spec: AskSpec }) {
  const [val, setVal] = useState(spec.initial ?? "");
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const submit = () => spec.resolve(val.trim() ? val.trim() : null);

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && spec.resolve(null)}>
      <div className="ask-modal">
        <div className="ask-title">{spec.title}</div>
        {spec.multiline ? (
          <textarea
            ref={ref}
            rows={4}
            value={val}
            placeholder={spec.placeholder}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); }
              if (e.key === "Escape") spec.resolve(null);
            }}
          />
        ) : (
          <>
            <input
              ref={ref}
              value={val}
              placeholder={spec.placeholder}
              list={spec.suggestions?.length ? "ask-suggestions" : undefined}
              onChange={(e) => setVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); submit(); }
                if (e.key === "Escape") spec.resolve(null);
              }}
            />
            {spec.suggestions?.length ? (
              <datalist id="ask-suggestions">
                {spec.suggestions.map((s) => <option key={s} value={s} />)}
              </datalist>
            ) : null}
            {spec.hint && <div className="ask-hint">{spec.hint}</div>}
          </>
        )}
        <div className="modal-actions">
          <span className="spacer" />
          <button className="btn" onClick={() => spec.resolve(null)}>Cancel</button>
          <button className="btn primary" onClick={submit}>
            <Icon name="check" size={14} /> {spec.okLabel ?? "OK"}
          </button>
        </div>
      </div>
    </div>
  );
}
