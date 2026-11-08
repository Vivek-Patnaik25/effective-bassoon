export const LABELS = {
  scalpel: "Scalpel (No. 10 Blade)",
  straight_dissection_clamp: "Straight Dissection Clamp",
  straight_mayo_scissor: "Straight Mayo Scissor",
  curved_mayo_scissor: "Curved Mayo Scissor",
};

export const SHORT_LABELS = {
  scalpel: "SCALPEL",
  straight_dissection_clamp: "CLAMP (STR)",
  straight_mayo_scissor: "SCISSOR (STR)",
  curved_mayo_scissor: "SCISSOR (CRV)",
};

export const CATEGORIES = {
  scalpel: "DISSECTION / INCISION",
  straight_dissection_clamp: "HEMOSTASIS / CLAMPING",
  straight_mayo_scissor: "FASCIA / SUTURE CUTTING",
  curved_mayo_scissor: "DEEP TISSUE DISSECTION",
};

export const COLORS = {
  scalpel: "#ef4444",                   // Crimson Alert Red
  straight_dissection_clamp: "#0ea5e9", // Precision Sky Blue
  straight_mayo_scissor: "#10b981",     // Clinical Emerald
  curved_mayo_scissor: "#f59e0b",       // Signal Amber
};

export function labelFor(name) {
  if (!name) return "—";
  return LABELS[name] || name;
}

export function shortLabelFor(name) {
  if (!name) return "—";
  return SHORT_LABELS[name] || name;
}

export function categoryFor(name) {
  return CATEGORIES[name] || "SURGICAL INSTRUMENT";
}

export function eventLabel(type) {
  switch (type) {
    case "tool_enter": return "TRAY ENTRY";
    case "tool_exit": return "TRAY EXIT";
    case "pause": return "HOLD / PAUSE";
    case "resume": return "LOG RESUME";
    case "mark": return "MILESTONE FLAG";
    default: return (type || "—").toUpperCase();
  }
}
