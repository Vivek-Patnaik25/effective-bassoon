import { useEffect, useRef, useState } from "react";
import { api, role, token, wsBase } from "./api";
import { COLORS, eventLabel, labelFor } from "./labels";

export default function Live() {
  const [name, setName] = useState("Procedure");
  const [session, setSession] = useState(null);
  const [msg, setMsg] = useState(null);
  const [summary, setSummary] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef(null);
  const wsRef = useRef(null);
  const imgRef = useRef(new Image());
  const frameTimesRef = useRef([]);
  const [fps, setFps] = useState(0);

  useEffect(() => {
    if (!session) {
      frameTimesRef.current = [];
      setFps(0);
    }
  }, [session]);

  useEffect(() => {
    function onKey(event) {
      if (event.repeat) return;
      if (event.target instanceof HTMLInputElement) return;
      if (event.key !== "p" && event.key !== "f" && event.key !== "P" && event.key !== "F") return;
      wsRef.current?.send(JSON.stringify({ type: "key", key: event.key.toLowerCase() }));
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      wsRef.current?.close();
    };
  }, []);

  useEffect(() => {
    if (!msg?.frame || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const image = imgRef.current;
    const tools = msg.tools || [];
    image.onload = () => {
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      tools.forEach((tool) => drawTool(ctx, tool));

      const now = performance.now();
      const times = frameTimesRef.current;
      times.push(now);
      while (times.length > 0 && times[0] <= now - 1000) {
        times.shift();
      }
      setFps(times.length);
    };
    image.src = `data:image/jpeg;base64,${msg.frame}`;
  }, [msg]);

  const lastGestureRef = useRef("none");

  useEffect(() => {
    const enters = (msg?.events || []).filter((row) => row.type === "tool_enter");
    if (enters.length > 0) {
      playChime(760, 0.12);
      const newAlerts = enters.map((row) => ({
        id: `${row.id || row.track_id}-${Date.now()}-${Math.random()}`,
        class_name: row.class_name,
        track_id: row.track_id,
      }));
      setAlerts((current) => [...newAlerts, ...current].slice(0, 5));

      newAlerts.forEach((item) => {
        setTimeout(() => {
          setAlerts((current) => current.filter((a) => a.id !== item.id));
        }, 4500);
      });
    }

    if (msg?.gesture && msg.gesture !== "none" && msg.gesture !== lastGestureRef.current) {
      playChime(520, 0.16);
      lastGestureRef.current = msg.gesture;
    } else if (!msg?.gesture || msg.gesture === "none") {
      lastGestureRef.current = "none";
    }
  }, [msg]);

  async function start(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const created = await api("/sessions", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      setSummary(null);
      setAlerts([]);
      setSession(created);
      openSocket(created.id);
    } catch (err) {
      if (err.status === 409 && err.detail?.session_id) {
        setError("A session is already open. End it, then start again.");
        setSession({ id: err.detail.session_id, name: "Open session" });
        openSocket(err.detail.session_id);
      } else {
        setError(err.message);
      }
    } finally {
      setBusy(false);
    }
  }

  function openSocket(sessionId) {
    wsRef.current?.close();
    const socket = new WebSocket(
      `${wsBase()}/ws?token=${encodeURIComponent(token())}&session_id=${sessionId}`
    );
    socket.onmessage = (event) => setMsg(JSON.parse(event.data));
    wsRef.current = socket;
  }

  async function end() {
    if (!session) return;
    setBusy(true);
    try {
      const result = await api(`/sessions/${session.id}/end`, { method: "POST" });
      wsRef.current?.close();
      setSummary(result.summary || []);
      setSession(null);
      setMsg(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function dropCamera() {
    await api("/camera/drop", { method: "POST" });
  }

  async function restoreCamera() {
    await api("/camera/restore", { method: "POST" });
  }

  return (
    <section className="live-grid">
      <div className="stage">
        {session && msg && (
          <div className="hud-overlay">
            <div className="hud-left">
              <span className={`hud-chip ${fps >= 15 ? "good" : "warning"}`}>
                <span className="dot" />
                {fps} FPS {fps >= 15 ? "(Target Met)" : "(Replay 10 FPS)"}
              </span>
              <span className="hud-chip">
                Tools in view: <strong>{(msg.tools || []).length}</strong>
              </span>
            </div>
            <div className="hud-right">
              {msg.gesture_raw && msg.gesture_raw !== "none" && (msg.gesture_progress || 0) > 0 && (
                <span className="hud-chip hold-chip">
                  <span className="hold-ring">
                    <svg viewBox="0 0 24 24" className="progress-svg">
                      <circle cx="12" cy="12" r="9" className="progress-bg" />
                      <circle
                        cx="12"
                        cy="12"
                        r="9"
                        className="progress-bar"
                        style={{
                          strokeDashoffset: `${56.5 * (1 - (msg.gesture_progress || 0))}`,
                        }}
                      />
                    </svg>
                  </span>
                  Hold {gestureText(msg.gesture_raw)} {Math.round((msg.gesture_progress || 0) * 100)}%
                </span>
              )}
              {msg.gesture && msg.gesture !== "none" && (
                <span className="hud-chip trigger-chip">
                  ⚡ {gestureText(msg.gesture)} Applied
                </span>
              )}
              <span className={`hud-chip ${msg.paused ? "paused" : "active"}`}>
                {msg.paused ? "⏸ LOGGING PAUSED" : "● LIVE LOGGING"}
              </span>
            </div>
          </div>
        )}
        <canvas ref={canvasRef} width="640" height="480" />
        {msg && msg.camera_ok === false && <div className="lost">Camera lost</div>}
        {!session && !msg && (
          <div className="stage-idle">Start a session to open the tool view.</div>
        )}
      </div>
      <aside className="panel side">
        {!session && (
          <form onSubmit={start}>
            <h2>New session</h2>
            <label>
              Procedure name
              <input value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <button type="submit" disabled={busy}>Start</button>
          </form>
        )}
        {session && (
          <>
            <h2>{session.name}</h2>
            <p className="status-row">
              <span>Gesture</span>
              <span className="gesture-val">
                <strong>{gestureText(msg?.gesture)}</strong>
                {msg?.gesture_raw && msg.gesture_raw !== "none" && (msg.gesture_progress || 0) > 0 && (
                  <span className="hold-badge">
                    {Math.round(msg.gesture_progress * 100)}%
                  </span>
                )}
              </span>
            </p>
            <p className="status-row">
              <span>Logging</span>
              <strong>{msg?.paused ? "Paused" : "On"}</strong>
            </p>
            <p className="muted small">
              {msg?.hand_camera
                ? "Hand camera is live. Hold an open palm to pause, a fist to mark."
                : "Hand camera is unavailable. Press P to pause and F to mark."}
            </p>
            <div className="button-row">
              <button type="button" onClick={end} disabled={busy}>End session</button>
            </div>
            <div className="diag-row">
              <span className="muted small">Simulation:</span>
              <button type="button" className="ghost mini" onClick={dropCamera}>Drop camera</button>
              <button type="button" className="ghost mini" onClick={restoreCamera}>Restore</button>
            </div>
          </>
        )}
        {error && <p className="alert-banner">{error}</p>}
        {alerts.length > 0 && (
          <div className="toasts-list">
            {alerts.map((row) => (
              <div key={row.id} className="toast-item">
                <div className="toast-main">
                  <span className="toast-tag">ENTER</span>
                  <strong>{labelFor(row.class_name)}</strong>
                  <span className="toast-track">#{row.track_id}</span>
                </div>
                <button
                  type="button"
                  className="toast-close"
                  onClick={() => setAlerts((curr) => curr.filter((a) => a.id !== row.id))}
                  title="Dismiss alert"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        {summary && (
          <div>
            <h2>Enter counts</h2>
            <Summary rows={summary} />
            {role() === "admin" && (
              <p className="muted small">Open History to download the PDF.</p>
            )}
          </div>
        )}
        <h2>Instrument log</h2>
        <Log rows={msg?.log || []} />
      </aside>
    </section>
  );
}

function drawTool(ctx, tool) {
  const [x, y, w, h] = tool.bbox;
  const color = COLORS[tool.class] || "#f4f1ea";
  ctx.strokeStyle = color;
  ctx.lineWidth = tool.loggable ? 2.5 : 1.5;
  ctx.setLineDash(tool.loggable ? [] : [5, 4]);
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([]);

  // Medical HUD corner reticles
  const bracket = Math.min(12, Math.floor(w / 3), Math.floor(h / 3));
  if (bracket > 2) {
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = color;
    // Top-left
    ctx.beginPath();
    ctx.moveTo(x, y + bracket);
    ctx.lineTo(x, y);
    ctx.lineTo(x + bracket, y);
    ctx.stroke();
    // Top-right
    ctx.beginPath();
    ctx.moveTo(x + w - bracket, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + bracket);
    ctx.stroke();
    // Bottom-left
    ctx.beginPath();
    ctx.moveTo(x, y + h - bracket);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x + bracket, y + h);
    ctx.stroke();
    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(x + w - bracket, y + h);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + w, y + h - bracket);
    ctx.stroke();
  }

  // Label badge with class & confidence %
  const text = `${labelFor(tool.class)} ${Math.round(tool.conf * 100)}%`;
  ctx.font = "bold 13px Segoe UI, sans-serif";
  const width = ctx.measureText(text).width + 12;
  const top = Math.max(0, y - 22);
  ctx.fillStyle = "rgba(12, 18, 16, 0.88)";
  ctx.fillRect(x, top, width, 20);
  ctx.fillStyle = color;
  ctx.fillText(text, x + 6, top + 15);
}

function gestureText(gesture) {
  if (gesture === "open_palm") return "Open palm";
  if (gesture === "fist") return "Fist";
  return "Neutral";
}

function Summary({ rows }) {
  if (!rows.length) return <p className="muted">No instruments entered.</p>;
  return (
    <ul className="summary">
      {rows.map((row) => (
        <li key={row.class} className={row.enter_count === 0 ? "zero-count" : ""}>
          <span>{labelFor(row.class)}</span>
          <strong>{row.enter_count}</strong>
        </li>
      ))}
    </ul>
  );
}

function Log({ rows }) {
  if (!rows.length) return <p className="muted">No procedure rows yet.</p>;
  return (
    <table>
      <thead>
        <tr>
          <th>Time</th>
          <th>Event</th>
          <th>Tool</th>
          <th>Id</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td>{String(row.ts).slice(11, 19)}</td>
            <td>{eventLabel(row.type)}</td>
            <td>{labelFor(row.class_name)}</td>
            <td>{row.track_id ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function playChime(freq = 660, duration = 0.12) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {
    // browser auto-play policy or unsupported
  }
}
