"use client";

import { useEffect, useState } from "react";
import Icon from "./Icon";

// A full-collection emoji picker. On macOS these glyphs render with the system
// "Apple Color Emoji" font automatically (see .emoji-glyph in globals.css), so
// the picker already looks like the Apple set on the Mac app — no font bundling
// needed here. (Bundling samuelngs/apple-emoji-ttf would only matter for making
// Windows/Linux builds render identically.)

// contiguous, densely-assigned Unicode emoji blocks → generated so we cover the
// whole range without hand-typing hundreds of glyphs
const cp = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => String.fromCodePoint(a + i));

const CATEGORIES: { id: string; label: string; emoji: string; list: string[] }[] = [
  {
    id: "smileys", label: "Smileys & emotion", emoji: "😀",
    list: [
      ...cp(0x1f600, 0x1f64f), // faces + gestures
      ...cp(0x1f910, 0x1f92f), // more faces
      ...cp(0x1f970, 0x1f97a),
      "☺️", "🙂", "🙃", "😉", "🥲", "🥹", "😙", "😚", "😗", "🤠", "🥳", "🥸", "😎", "🤓", "🧐",
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "💯", "💢", "💥", "💫", "💦", "💨", "🕳️", "💬", "💭", "💤",
    ],
  },
  {
    id: "people", label: "People & body", emoji: "🧑",
    list: [
      "👋", "🤚", "🖐️", "✋", "🖖", "🫱", "🫲", "🫳", "🫴", "👌", "🤌", "🤏", "✌️", "🤞", "🫰", "🤟", "🤘", "🤙", "👈", "👉", "👆", "🖕", "👇", "☝️", "👍", "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌", "🫶", "👐", "🤲", "🤝", "🙏", "✍️", "💅", "🤳", "💪", "🦾", "🦵", "🦿", "🦶", "👂", "🦻", "👃", "🧠", "🫀", "🫁", "🦷", "🦴", "👀", "👁️", "👅", "👄", "🫦",
      "👶", "🧒", "👦", "👧", "🧑", "👨", "👩", "🧓", "👴", "👵", "🧑‍💻", "👨‍💻", "👩‍💻", "🧑‍🔬", "🧑‍🏫", "🧑‍⚖️", "🧑‍🚀", "🧑‍🎨", "🧑‍🔧", "🕵️", "💂", "🥷", "👷", "🤴", "👸", "🦸", "🦹", "🧙", "🧚", "🧛", "🧜", "🧝", "🧞", "🧟", "🧑‍🚀", "👻", "👽", "🤖", "🎃",
    ],
  },
  {
    id: "animals", label: "Animals & nature", emoji: "🐻",
    list: [
      ...cp(0x1f400, 0x1f43e), // rat → paw prints
      "🐶", "🐱", "🦊", "🦝", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮", "🐷", "🐸", "🐵", "🙈", "🙉", "🙊", "🦄", "🦓", "🦒", "🦔", "🦇", "🦋", "🐝", "🐞", "🦗", "🕷️", "🦂", "🐢", "🐍", "🦖", "🦕", "🐙", "🦑", "🦐", "🦀", "🐡", "🐠", "🐟", "🐬", "🐳", "🐋", "🦈", "🦭", "🦦", "🦥", "🦨", "🦡",
      "🌵", "🎄", "🌲", "🌳", "🌴", "🌱", "🌿", "☘️", "🍀", "🎍", "🌾", "🌷", "🌹", "🥀", "🌺", "🌸", "🌼", "🌻", "🍁", "🍂", "🍃", "🍄", "🌰", "🌍", "🌙", "⭐", "🌟", "✨", "☀️", "⛅", "☁️", "🌈", "❄️", "⚡", "💧", "🌊",
    ],
  },
  {
    id: "food", label: "Food & drink", emoji: "🍔",
    list: [
      ...cp(0x1f345, 0x1f37f), // tomato → baby bottle
      ...cp(0x1f950, 0x1f96f), // croissant → bagel
      "☕", "🍵", "🫖", "🧋", "🍶", "🍺", "🍻", "🥂", "🍷", "🥃", "🍸", "🍹", "🧉", "🍾", "🧊", "🥄", "🍴", "🍽️", "🥢",
    ],
  },
  {
    id: "travel", label: "Travel & places", emoji: "✈️",
    list: [
      ...cp(0x1f680, 0x1f6a4), // rocket → speedboat
      "🚗", "🚕", "🚙", "🚌", "🚎", "🏎️", "🚓", "🚑", "🚒", "🚐", "🛻", "🚚", "🚛", "🚜", "🏍️", "🛵", "🚲", "🛴", "🛺", "✈️", "🛩️", "🛫", "🛬", "🚀", "🛸", "🚁", "⛵", "🚤", "🛥️", "🚢", "⚓", "🏰", "🏯", "🏟️", "🗼", "🗽", "🗿", "⛰️", "🏔️", "🌋", "🏕️", "🏖️", "🏜️", "🏝️", "🌆", "🌃", "🌉", "🌁",
    ],
  },
  {
    id: "activities", label: "Activities", emoji: "⚽",
    list: [
      "⚽", "🏀", "🏈", "⚾", "🥎", "🎾", "🏐", "🏉", "🥏", "🎱", "🪀", "🏓", "🏸", "🏒", "🏑", "🥍", "🏏", "🥅", "⛳", "🪁", "🏹", "🎣", "🤿", "🥊", "🥋", "🎽", "🛹", "🛼", "🛷", "⛸️", "🥌", "🎿", "⛷️", "🏂", "🏋️", "🤼", "🤸", "⛹️", "🤾", "🏌️", "🏇", "🧘", "🏄", "🏊", "🤽", "🚣", "🧗", "🚵", "🚴",
      "🏆", "🥇", "🥈", "🥉", "🏅", "🎖️", "🏵️", "🎗️", "🎫", "🎟️", "🎪", "🎭", "🎨", "🎬", "🎤", "🎧", "🎼", "🎹", "🥁", "🎷", "🎺", "🎸", "🪕", "🎻", "🎲", "♟️", "🎯", "🎳", "🎮", "🕹️", "🎰", "🧩",
    ],
  },
  {
    id: "objects", label: "Objects", emoji: "💡",
    list: [
      "⌚", "📱", "💻", "⌨️", "🖥️", "🖨️", "🖱️", "🖲️", "💽", "💾", "💿", "📀", "🧮", "🎥", "📷", "📸", "📹", "📼", "🔍", "🔎", "🕯️", "💡", "🔦", "🏮", "📔", "📕", "📖", "📗", "📘", "📙", "📚", "📓", "📒", "📃", "📜", "📄", "📰", "📑", "🔖", "🏷️", "💰", "🪙", "💴", "💵", "💶", "💷", "💳", "🧾", "💸",
      "✉️", "📧", "📨", "📩", "📤", "📥", "📦", "📫", "📮", "🗳️", "✏️", "✒️", "🖋️", "🖊️", "🖌️", "🖍️", "📝", "💼", "📁", "📂", "🗂️", "📅", "📆", "🗒️", "🗓️", "📇", "📈", "📉", "📊", "📋", "📌", "📍", "📎", "🖇️", "📏", "📐", "✂️", "🗃️", "🗄️", "🗑️", "🔒", "🔓", "🔏", "🔐", "🔑", "🗝️", "🔨", "🪓", "⛏️", "⚒️", "🛠️", "🗡️", "⚔️", "🔧", "🪛", "🔩", "⚙️", "🧰", "🧲", "🔬", "🔭", "📡", "🧯", "🛢️", "💎", "🔮",
    ],
  },
  {
    id: "symbols", label: "Symbols", emoji: "🔷",
    list: [
      "⚡", "🔥", "🌟", "⭐", "✨", "💫", "❄️", "♻️", "✅", "❇️", "✳️", "❎", "✔️", "☑️", "🔰", "⚛️", "🕉️", "✡️", "☸️", "☯️", "✝️", "☦️", "⛎", "♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓",
      "🆔", "⚠️", "🚸", "🔱", "📛", "✴️", "🟩", "🟦", "🟪", "🟥", "🟧", "🟨", "⬛", "⬜", "🔶", "🔷", "🔸", "🔹", "🔺", "🔻", "💠", "🔘", "🔲", "🔳", "➕", "➖", "✖️", "➗", "♾️", "❗", "❓", "❔", "❕", "‼️", "⁉️", "💲", "💱",
    ],
  },
];

export default function EmojiPicker({
  onPick,
  onClose,
}: {
  onPick: (emoji: string) => void;
  onClose: () => void;
}) {
  const [cat, setCat] = useState(CATEGORIES[0].id);

  // Escape closes it too. Rendered as its own overlay so it can never be clipped
  // by the (overflow:auto) agent modal and the close always works.
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [onClose]);

  const active = CATEGORIES.find((c) => c.id === cat) ?? CATEGORIES[0];
  // de-dupe (ranges + curated additions can overlap)
  const list = Array.from(new Set(active.list));

  return (
    <div
      className="emoji-overlay"
      onMouseDown={(e) => {
        e.stopPropagation(); // don't bubble to the agent modal's backdrop
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="emoji-pop" onMouseDown={(e) => e.stopPropagation()}>
        <div className="emoji-tabs">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              className={`emoji-tab ${cat === c.id ? "sel" : ""}`}
              title={c.label}
              onClick={() => setCat(c.id)}
            >
              <span className="emoji-glyph">{c.emoji}</span>
            </button>
          ))}
          <span className="emoji-spacer" />
          <button className="emoji-close" title="Close" onClick={onClose}>
            <Icon name="close" size={15} />
          </button>
        </div>
        <div className="emoji-cat-label">{active.label}</div>
        <div className="emoji-grid">
          {list.map((e, i) => (
            <button key={active.id + i} className="emoji-cell" onClick={() => onPick(e)} title={e}>
              <span className="emoji-glyph">{e}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
