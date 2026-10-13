export const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export function wsBase() {
  return API.replace(/^http/, "ws");
}

export function token() {
  return sessionStorage.getItem("token") || "";
}

export function role() {
  return sessionStorage.getItem("role") || "";
}

function headers(extra) {
  const current = token();
  return {
    ...(extra || {}),
    ...(current ? { Authorization: `Bearer ${current}` } : {}),
  };
}

export async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...headers(options.headers),
    },
  });
  if (response.status === 401 && !path.endsWith("/login")) {
    sessionStorage.clear();
    window.location.assign("/");
  }
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const detail = data && data.detail;
    const message =
      typeof detail === "string" ? detail : (detail && detail.message) || "Request failed";
    const error = new Error(message);
    error.status = response.status;
    error.detail = detail;
    throw error;
  }
  return data;
}

export async function downloadPdf(sessionId) {
  const response = await fetch(`${API}/sessions/${sessionId}/report.pdf`, {
    headers: headers(),
  });
  if (!response.ok) {
    throw new Error("Could not download the report");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `session-${sessionId}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}
