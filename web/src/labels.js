export const LABELS = {
  scalpel: "Scalpel",
  straight_dissection_clamp: "Straight dissection clamp",
  straight_mayo_scissor: "Straight Mayo scissor",
  curved_mayo_scissor: "Curved Mayo scissor",
};

export const COLORS = {
  scalpel: "#e85d4c",
  straight_dissection_clamp: "#3d9cf0",
  straight_mayo_scissor: "#3ecf8e",
  curved_mayo_scissor: "#f0c14d",
};

export function labelFor(name) {
  if (!name) return "—";
  return LABELS[name] || name;
}

export function eventLabel(type) {
  if (type === "tool_enter") return "enter";
  if (type === "tool_exit") return "exit";
  if (type === "pause") return "pause";
  if (type === "resume") return "resume";
  if (type === "mark") return "mark";
  return type || "—";
}
