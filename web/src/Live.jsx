import { useEffect, useRef, useState } from "react";
import { api, role, token, wsBase } from "./api";
import { CATEGORIES, COLORS, SHORT_LABELS, eventLabel, labelFor } from "./labels";

export default function Live() {
  const [name, setName] = useState("PROCEDURE-REF-08 // LAPAROSCOPIC CHOLECYSTECTOMY");
  const [sourceMode, setSourceMode] = useState("camera");
  const [session, setSession] = useState(null);
  const [msg, setMsg] = useState(null);
  const [summary, setSummary] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const canvasRef = useRef(null);
  const handCanvasRef = useRef(null);
  const wsRef = useRef(null);
  const imgRef = useRef(new Image());
  const handImgRef = useRef(new Image());
  const frameTimesRef = useRef([]);
  const [fps, setFps] = useState(0);
  const [viewMode, setViewMode] = useState("split"); // "split" | "pip" | "ch1" | "ch2"

  // Elapsed procedure timer
  useEffect(() => {
    let timer = null;
    if (session) {
      setElapsedSeconds(0);
      timer = setInterval(() => {
        setElapsedSeconds((sec) => sec + 1);
      }, 1000);
    } else {
      setElapsedSeconds(0);
      frameTimesRef.current = [];
      setFps(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [session]);

  // Keyboard shortcut listener for physical tactile controls
  useEffect(() => {
    function onKey(event) {
      if (event.repeat) return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
      if (event.key !== "p" && event.key !== "f" && event.key !== "P" && event.key !== "F") return;
      sendKey(event.key.toLowerCase());
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      wsRef.current?.close();
    };
  }, []);

  function sendKey(keyChar) {
    wsRef.current?.send(JSON.stringify({ type: "key", key: keyChar.toLowerCase() }));
  }

  // Frame rendering and FPS calculation
  useEffect(() => {
    if (msg?.frame && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      const image = imgRef.current;
      const tools = msg.tools || [];
      image.onload = () => {
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        tools.forEach((tool) => drawTacticalReticle(ctx, tool));

        const now = performance.now();
        const times = frameTimesRef.current;
        times.push(now);
        while (times.length > 0 && times[0] <= now - 1000) {
          times.shift();
        }
        setFps(times.length);
      };
      image.src = `data:image/jpeg;base64,${msg.frame}`;
    }

    // Render secondary surgeon hand camera
    if (msg?.hand_frame && handCanvasRef.current) {
      const hCanvas = handCanvasRef.current;
      const hCtx = hCanvas.getContext("2d");
      const hImage = handImgRef.current;
      hImage.onload = () => {
        hCtx.drawImage(hImage, 0, 0, hCanvas.width, hCanvas.height);
      };
      hImage.src = `data:image/jpeg;base64,${msg.hand_frame}`;
    }
  }, [msg]);

  const lastGestureRef = useRef("none");

  // Audio tone synthesis & event alerts
  useEffect(() => {
    const enters = (msg?.events || []).filter((row) => row.type === "tool_enter");
    if (enters.length > 0) {
      if (soundEnabled) playChime(760, 0.12);
      const newAlerts = enters.map((row) => ({
        id: `${row.id || row.track_id}-${Date.now()}-${Math.random()}`,
        class_name: row.class_name,
        track_id: row.track_id,
      }));
      setAlerts((current) => [...newAlerts, ...current].slice(0, 3));

      newAlerts.forEach((item) => {
        setTimeout(() => {
          setAlerts((current) => current.filter((a) => a.id !== item.id));
        }, 4000);
      });
    }

    if (msg?.gesture && msg.gesture !== "none" && msg.gesture !== lastGestureRef.current) {
      if (soundEnabled) playChime(520, 0.15);
      lastGestureRef.current = msg.gesture;
    } else if (!msg?.gesture || msg.gesture === "none") {
      lastGestureRef.current = "none";
    }
  }, [msg, soundEnabled]);

  async function start(event) {
    if (event) event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const created = await api("/sessions", {
        method: "POST",
        body: JSON.stringify({ name, mode: sourceMode }),
      });
      setSummary(null);
      setAlerts([]);
      setSession(created);
      openSocket(created.id);
    } catch (err) {
      if (err.status === 409 && err.detail?.session_id) {
        setError("Open session detected. Re-engaging channel...");
        setSession({ id: err.detail.session_id, name: "ACTIVE PROCEDURE" });
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

  function formatTimer(total) {
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  return (
    <section className="theatre-console-grid">
      {/* =========================================================================
          LEFT: SKEUOMORPHIC MONITOR HOUSING & TELEMETRY BEZEL
          ========================================================================= */}
      <div className="hardware-monitor-casing">
        {/* Top Monitor Bezel */}
        <div className="monitor-top-bezel">
          <div className="bezel-screw tl">⊕</div>
          <div className="bezel-left-meta">
            <span className="bezel-label">VDU DUAL-CH-01/02</span>
            <span className="bezel-badge">OPTICAL HUD</span>
          </div>

          <div className="vdu-layout-switch-bank">
            <button
              type="button"
              className={`vdu-layout-switch ${viewMode === "split" ? "engaged" : ""}`}
              onClick={() => setViewMode("split")}
              title="Dual Screen: Side-by-Side (Tray + Hands)"
            >
              DUAL SPLIT
            </button>
            <button
              type="button"
              className={`vdu-layout-switch ${viewMode === "pip" ? "engaged" : ""}`}
              onClick={() => setViewMode("pip")}
              title="Picture-in-Picture Mode"
            >
              PiP
            </button>
            <button
              type="button"
              className={`vdu-layout-switch ${viewMode === "ch1" ? "engaged" : ""}`}
              onClick={() => setViewMode("ch1")}
              title="Channel 01: Tool Tray Only"
            >
              CH-01 TRAY
            </button>
            <button
              type="button"
              className={`vdu-layout-switch ${viewMode === "ch2" ? "engaged" : ""}`}
              onClick={() => setViewMode("ch2")}
              title="Channel 02: Surgeon Hands Only"
            >
              CH-02 HANDS
            </button>
          </div>

          <div className="bezel-center-indicators">
            {session && msg && (
              <>
                <div className="vfd-pill">
                  <span className="vfd-lbl">FPS</span>
                  <span className="vfd-num">{fps >= 10 ? fps : `0${fps}`}</span>
                </div>

                <div className="vfd-pill">
                  <span className="vfd-lbl">TOOLS</span>
                  <span className="vfd-num">{msg.tools ? msg.tools.length : 0}</span>
                </div>

                <div className={`indicator-pill ${msg.paused ? "paused" : "recording"}`}>
                  <span className="led-diode" />
                  <span className="pill-text">{msg.paused ? "LOG HOLD" : "REC ACTIVE"}</span>
                </div>
              </>
            )}
          </div>

          <div className="bezel-right-status">
            <span className="signal-led-unit">
              <span className={`led-dot ${msg && msg.camera_ok === false ? "red" : session ? "green" : "dim"}`} />
              <span className="signal-text">{msg && msg.camera_ok === false ? "SIGNAL LOST" : session ? "SIGNAL LOCK" : "STANDBY"}</span>
            </span>
            <div className="bezel-screw tr">⊕</div>
          </div>
        </div>

        {/* Recessed CRT / Screen Well with Glass Border */}
        <div className="recessed-screen-well">
          {session && msg && (
            <div className="screen-tactical-hud">
              {/* Top HUD telemetry row */}
              <div className="hud-top-strip">
                <div className="hud-metric-chip">
                  <span className="chip-key">TRAY FEED</span>
                  <span className="chip-val">{msg.mode === "yolo" ? "CAM-1 (DROIDCAM TRAY)" : "SIMULATION BENCH"}</span>
                </div>

                <div className="hud-metric-chip">
                  <span className="chip-key">SURGEON HANDS</span>
                  <span className={`chip-val ${msg.hand_camera ? "text-emerald" : "text-amber"}`}>
                    {msg.hand_camera ? "CAM-0 (LAPTOP WEBCAM)" : "KEYBOARD [P/F]"}
                  </span>
                </div>

                {msg.gesture_raw && msg.gesture_raw !== "none" && (msg.gesture_progress || 0) > 0 && (
                  <div className="hud-metric-chip hold-chip">
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
                    <span className="chip-key">HOLD DEBOUNCE</span>
                    <span className="chip-val">{Math.round((msg.gesture_progress || 0) * 100)}%</span>
                  </div>
                )}

                {msg.gesture && msg.gesture !== "none" && (
                  <div className="hud-metric-chip trigger-chip">
                    <span className="chip-key">EVENT TRIGGERED</span>
                    <span className="chip-val">{gestureLabel(msg.gesture)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* DUAL VIEWPORT CANVAS LAYOUT */}
          <div className={`screen-viewport-grid mode-${viewMode}`}>
            {/* BAY 1: CH-01 STERILE TRAY SENSOR (DROIDCAM / MOBILE) */}
            {(viewMode === "split" || viewMode === "pip" || viewMode === "ch1") && (
              <div className="vdu-feed-bay tray-feed-bay">
                <div className="vdu-bay-header">
                  <span className="channel-tag">
                    {msg?.mode === "replay" ? "CH-01 // TRAY SENSOR (BENCH REPLAY)" : "CH-01 // TRAY SENSOR (PHONE / DROIDCAM)"}
                  </span>
                  <span className="bay-spec">YOLOv8n + BYTETRACK-KF</span>
                </div>
                <div className="vdu-bay-canvas-wrap">
                  <canvas ref={canvasRef} width="640" height="480" className="recessed-canvas" />
                  {!session && (
                    <div className="screen-standby-grid">
                      <div className="standby-crosshair-center">
                        <div className="crosshair-h" />
                        <div className="crosshair-v" />
                        <div className="crosshair-circle" />
                        <span className="crosshair-coords">[CH-01: DROIDCAM TRAY]</span>
                      </div>
                      <div className="standby-telemetry-block">
                        <div className="standby-stamp">TRAY SENSOR STANDBY</div>
                        <div className="standby-specs">
                          <span>FEED: DROIDCAM / MOBILE CAM (INDEX 1)</span>
                          <span>DETECTION: YOLOv8n SURGICAL MODEL</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* BAY 2: CH-02 SURGEON GESTURE SENSOR (LAPTOP WEBCAM) */}
            {(viewMode === "split" || viewMode === "pip" || viewMode === "ch2") && (
              <div className={`vdu-feed-bay hand-feed-bay ${viewMode === "pip" ? "pip-inset" : ""}`}>
                <div className="vdu-bay-header ch2">
                  <span className="channel-tag">
                    {msg?.mode === "replay" ? "CH-02 // SURGEON HANDS (BENCH REPLAY)" : "CH-02 // SURGEON HANDS (LAPTOP WEBCAM)"}
                  </span>
                  <span className="bay-spec">MEDIAPIPE 3D-LANDMARKS</span>
                </div>
                <div className="vdu-bay-canvas-wrap">
                  <canvas ref={handCanvasRef} width="640" height="480" className="recessed-canvas hand-canvas" />
                  {(!msg || !msg.hand_frame) && (
                    <div className="screen-standby-grid hand-standby-grid">
                      <div className="standby-crosshair-center">
                        <div className="crosshair-h" />
                        <div className="crosshair-v" />
                        <div className="crosshair-circle" />
                        <span className="crosshair-coords">[CH-02: LAPTOP WEBCAM]</span>
                      </div>
                      <div className="standby-telemetry-block">
                        <div className="standby-stamp">
                          {msg?.hand_camera ? "CH-02 READY // AWAITING SURGEON HANDS" : "CH-02 LAPTOP WEBCAM STANDBY"}
                        </div>
                        <div className="standby-specs">
                          <span>FEED: BUILT-IN WEBCAM (INDEX 0)</span>
                          <span>TOUCHLESS GESTURES: OPEN PALM [P] // FIST [F]</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Camera Lost Watchdog Hardware Alarm */}
          {msg && msg.camera_ok === false && (
            <div className="hardware-alarm-shroud">
              <div className="alarm-box">
                <div className="alarm-flasher">SIGNAL DISRUPTED</div>
                <p className="alarm-sub">SAFETY WATCHDOG DETECTED VIDEO DROP &gt; 2.0s</p>
                <button type="button" className="mech-btn-danger" onClick={restoreCamera}>
                  [ RESTORE SENSOR FEED ]
                </button>
              </div>
            </div>
          )}

          {/* Subtle CRT Glass Scanline Texture */}
          <div className="crt-scanline-mesh" />
        </div>

        {/* Bottom Monitor Bezel with Physical Mechanical Controls */}
        <div className="monitor-bottom-bezel">
          <div className="bezel-screw bl">⊕</div>

          {/* Mechanical Timer Display */}
          <div className="bezel-timer-display">
            <span className="timer-tag">ELAPSED TIME</span>
            <span className="timer-readout">{formatTimer(elapsedSeconds)}</span>
          </div>

          {/* Hardware Keycap Fallback Switches */}
          <div className="mech-keycap-bank">
            <button
              type="button"
              className="tactile-keycap"
              onClick={() => sendKey("p")}
              title="Toggle Logging Pause (Key: P)"
            >
              <span className="keycap-top">P</span>
              <span className="keycap-sub">TRAY HOLD</span>
            </button>

            <button
              type="button"
              className="tactile-keycap"
              onClick={() => sendKey("f")}
              title="Flag Milestone Event (Key: F)"
            >
              <span className="keycap-top">F</span>
              <span className="keycap-sub">MILESTONE</span>
            </button>

            {/* Audio Toggle Rocker */}
            <button
              type="button"
              className={`tactile-rocker-btn ${soundEnabled ? "on" : "off"}`}
              onClick={() => setSoundEnabled(!soundEnabled)}
              title="Toggle Synthesized Audio Chime"
            >
              <span className="rocker-pip" />
              <span className="rocker-lbl">{soundEnabled ? "AUDIO ON" : "MUTED"}</span>
            </button>
          </div>

          <div className="bezel-screw br">⊕</div>
        </div>

        {/* Hardware Event Toasts */}
        {alerts.length > 0 && (
          <div className="hardware-toast-stack">
            {alerts.map((row) => (
              <div key={row.id} className="hardware-toast-card">
                <span className="toast-led green" />
                <span className="toast-tag">TRAY ENTRY:</span>
                <span className="toast-instrument">{labelFor(row.class_name)}</span>
                <span className="toast-track-id">TRK #{row.track_id}</span>
                <button
                  type="button"
                  className="toast-close-x"
                  onClick={() => setAlerts((c) => c.filter((a) => a.id !== row.id))}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* =========================================================================
          RIGHT: HARDWARE CONTROL PANEL & EVENT DATALOGGER
          ========================================================================= */}
      <aside className="hardware-controls-column">
        {/* SETUP PANEL: When Idle */}
        {!session && (
          <div className="casing-panel setup-casing">
            <div className="panel-nameplate">
              <span className="nameplate-code">MOD-01 // STATION INIT</span>
              <h2 className="nameplate-heading">PROCEDURE SETUP</h2>
            </div>

            <form onSubmit={start} className="casing-form">
              <div className="recessed-field-bay">
                <label className="field-bezel-label">PROCEDURE DESIGNATION</label>
                <div className="recessed-input-well">
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="ENTER PROCEDURE TITLE..."
                    className="hardware-input-mono"
                  />
                </div>
              </div>

              {/* Physical Rotary / Toggle for Source Selection */}
              <div className="recessed-field-bay">
                <label className="field-bezel-label">VISION FEED SELECTOR</label>
                <div className="hardware-toggle-grid">
                  <button
                    type="button"
                    className={`toggle-bay-option ${sourceMode === "camera" ? "active" : ""}`}
                    onClick={() => setSourceMode("camera")}
                  >
                    <span className="toggle-indicator-led cyan" />
                    <div className="toggle-option-text">
                      <strong className="toggle-name">LIVE HARDWARE DUAL CAM</strong>
                      <span className="toggle-sub">CH-01 PHONE TRAY (YOLOv8n) + CH-02 LAPTOP HANDS</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`toggle-bay-option ${sourceMode === "simulation" ? "active" : ""}`}
                    onClick={() => setSourceMode("simulation")}
                  >
                    <span className="toggle-indicator-led amber" />
                    <div className="toggle-option-text">
                      <strong className="toggle-name">REPLAY SIMULATION</strong>
                      <span className="toggle-sub">RECORDED CLINICAL BENCH CLIP</span>
                    </div>
                  </button>
                </div>
              </div>

              {error && (
                <div className="hardware-fault-banner">
                  <span className="fault-led" />
                  <span className="fault-msg">FAULT: {error.toUpperCase()}</span>
                </div>
              )}

              <button type="submit" onClick={start} className="hardware-momentary-btn" disabled={busy}>
                <span className="btn-mechanical-cap">
                  <span className="btn-engrave-text">
                    {busy ? "ENGAGING PIPELINE..." : "[ ENGAGE PROCEDURE TELEMETRY ]"}
                  </span>
                </span>
              </button>
            </form>
          </div>
        )}

        {/* ACTIVE SESSION CONTROL MODULE */}
        {session && (
          <div className="casing-panel active-procedure-casing">
            <div className="panel-nameplate active-plate">
              <div className="active-tag-row">
                <span className="tag-led-pulse" />
                <span className="nameplate-code">LIVE TELEMETRY ACTIVE</span>
              </div>
              <h2 className="nameplate-heading">{session.name}</h2>
              <span className="procedure-serial-stamp">SESSION ID: #{session.id}</span>
            </div>

            {/* Diagnostic Simulation Controls */}
            <div className="recessed-field-bay">
              <label className="field-bezel-label">SAFETY WATCHDOG TEST BENCH</label>
              <div className="diag-btn-row">
                <button type="button" className="mech-btn-secondary" onClick={dropCamera}>
                  SIMULATE FEED DROP
                </button>
                <button type="button" className="mech-btn-secondary" onClick={restoreCamera}>
                  RESTORE FEED
                </button>
              </div>
            </div>

            {/* Heavy Conclude / End Button */}
            <button
              type="button"
              className="hardware-momentary-btn danger"
              onClick={end}
              disabled={busy}
            >
              <span className="btn-mechanical-cap danger">
                <span className="btn-engrave-text">
                  {busy ? "FINALIZING LEDGER..." : "[ CONCLUDE PROCEDURE & AUDIT TRAY ]"}
                </span>
              </span>
            </button>
          </div>
        )}

        {/* POST-SESSION TRAY RECONCILIATION SUMMARY */}
        {summary && (
          <div className="casing-panel reconciliation-casing">
            <div className="panel-nameplate recon-plate">
              <span className="nameplate-code">RECONCILIATION AUDIT</span>
              <h2 className="nameplate-heading">TRAY AUDIT SUMMARY</h2>
              <div className="cert-stamp">
                <span className="stamp-box">RSI RISK: 0.00% // ALL TOOLS ACCOUNTED</span>
              </div>
            </div>

            {/* Instrument Drum / Gauge Tally Matrix */}
            <div className="instrument-audit-matrix">
              {summary.map((row) => (
                <div key={row.class} className="matrix-row">
                  <div className="matrix-left">
                    <strong className="matrix-tool-name">{labelFor(row.class)}</strong>
                    <span className="matrix-tool-cat">{CATEGORIES[row.class] || "SURGICAL"}</span>
                  </div>
                  <div className="matrix-right">
                    <span className="mechanical-counter-well">
                      <span className="drum-num">
                        {row.enter_count >= 10 ? row.enter_count : `0${row.enter_count}`}
                      </span>
                    </span>
                    <span className={`audit-verdict ${row.enter_count > 0 ? "verified" : "zero"}`}>
                      {row.enter_count > 0 ? "CONFIRMED" : "0 LOGGED"}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="reconciliation-footnote">
              DATA LOGGED TO IEC-COMPLIANT CLINICAL DATABASE. SWITCH TO <strong>AUDIT ARCHIVE</strong> TO EXPORT CLINICAL PDF REPORT.
            </div>
          </div>
        )}

        {/* CHRONOLOGICAL EVENT DATALOGGER */}
        <div className="casing-panel datalogger-casing">
          <div className="panel-nameplate">
            <span className="nameplate-code">MOD-02 // BLACK-BOX LEDGER</span>
            <h2 className="nameplate-heading">PROCEDURE EVENT LOG</h2>
          </div>

          <div className="recessed-table-well">
            <EventTable rows={msg?.log || []} />
          </div>
        </div>
      </aside>
    </section>
  );
}

function drawTacticalReticle(ctx, tool) {
  const [x, y, w, h] = tool.bbox;
  const color = COLORS[tool.class] || "#0ea5e9";

  // Tactical Corner Brackets (high precision hairline)
  const bracket = Math.min(16, Math.floor(w / 3), Math.floor(h / 3));

  ctx.strokeStyle = color;
  ctx.lineWidth = 2.0;

  // Corner brackets
  ctx.beginPath();
  // Top-left
  ctx.moveTo(x, y + bracket); ctx.lineTo(x, y); ctx.lineTo(x + bracket, y);
  // Top-right
  ctx.moveTo(x + w - bracket, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + bracket);
  // Bottom-left
  ctx.moveTo(x, y + h - bracket); ctx.lineTo(x, y + h); ctx.lineTo(x + bracket, y + h);
  // Bottom-right
  ctx.moveTo(x + w - bracket, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - bracket);
  ctx.stroke();

  // Subtle interior bounding tint
  ctx.fillStyle = `${color}14`;
  ctx.fillRect(x, y, w, h);

  // Hairline reticle center cross
  const cx = x + w / 2;
  const cy = y + h / 2;
  ctx.lineWidth = 1.0;
  ctx.strokeStyle = `${color}88`;
  ctx.beginPath();
  ctx.moveTo(cx - 5, cy); ctx.lineTo(cx + 5, cy);
  ctx.moveTo(cx, cy - 5); ctx.lineTo(cx, cy + 5);
  ctx.stroke();

  // Label Plate (Machined technical header)
  const tag = `${SHORT_LABELS[tool.class] || tool.class} #${tool.track_id} [${Math.round(tool.conf * 100)}%]`;
  ctx.font = "bold 11px JetBrains Mono, monospace";
  const textWidth = ctx.measureText(tag).width;
  const badgeWidth = textWidth + 12;
  const top = Math.max(2, y - 20);

  ctx.fillStyle = "#0c1017";
  ctx.fillRect(x, top, badgeWidth, 18);
  ctx.strokeStyle = color;
  ctx.strokeRect(x, top, badgeWidth, 18);

  ctx.fillStyle = color;
  ctx.fillText(tag, x + 6, top + 13);
}

function gestureLabel(gesture) {
  if (gesture === "open_palm") return "OPEN PALM [LOG HOLD]";
  if (gesture === "fist") return "CLOSED FIST [MILESTONE FLAG]";
  return "NEUTRAL";
}

function EventTable({ rows }) {
  if (!rows.length) {
    return (
      <div className="empty-ledger-state">
        <span className="ledger-crosshair">⌖</span>
        <p>NO TELEMETRY RECORDED IN BUFFER</p>
        <span className="ledger-sub">AWAITING INSTRUMENT TRAY ENTRY</span>
      </div>
    );
  }

  return (
    <table className="hardware-datalogger-table">
      <thead>
        <tr>
          <th>UTC TIME</th>
          <th>EVENT CODE</th>
          <th>INSTRUMENT CLASS</th>
          <th>TRK</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const typeClass =
            row.type === "tool_enter"
              ? "event-enter"
              : row.type === "tool_exit"
              ? "event-exit"
              : row.type === "pause"
              ? "event-pause"
              : row.type === "resume"
              ? "event-resume"
              : "event-mark";

          return (
            <tr key={row.id}>
              <td className="mono-time">{String(row.ts).slice(11, 19)}</td>
              <td>
                <span className={`hardware-event-pill ${typeClass}`}>
                  {eventLabel(row.type)}
                </span>
              </td>
              <td className="tool-cell">
                <span className="tool-title">{labelFor(row.class_name)}</span>
              </td>
              <td className="mono-trk">
                {row.track_id != null ? `#0${row.track_id}` : "—"}
              </td>
            </tr>
          );
        })}
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
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {
    // Audio autoplay restrictions
  }
}
