import { useEffect, useState } from "react";
import { Navigate, Route, useLocation, Routes, useNavigate } from "react-router-dom";
import { api, role, token } from "./api";
import History from "./History";
import Live from "./Live";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/live" element={<Protected><Live /></Protected>} />
      <Route path="/history" element={<Protected admin><History /></Protected>} />
      <Route path="/history/:id" element={<Protected admin><History /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function Protected({ children, admin = false }) {
  if (!token()) return <Navigate to="/" replace />;
  if (admin && role() !== "admin") return <Navigate to="/live" replace />;
  return (
    <div className="console-chassis">
      <ConsoleRackHeader />
      <main className="console-workspace">{children}</main>
    </div>
  );
}

function ConsoleRackHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = role() === "admin";
  const username = sessionStorage.getItem("username") || (isAdmin ? "admin" : "nurse");
  const [timeStr, setTimeStr] = useState("");

  useEffect(() => {
    function updateClock() {
      const now = new Date();
      setTimeStr(now.toTimeString().split(" ")[0]);
    }
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  const isLive = location.pathname.startsWith("/live");
  const isHistory = location.pathname.startsWith("/history");

  return (
    <header className="rack-header">
      {/* Left Chassis Screw & Manufacturer Nameplate */}
      <div className="rack-brand-unit">
        <div className="screw screw-tl">⊕</div>
        <div className="metal-nameplate">
          <div className="nameplate-inner">
            <span className="brand-series">SURG-TRACK™</span>
            <span className="brand-model">SERIES 8000</span>
          </div>
          <span className="nameplate-sub">SURGICAL INSTRUMENT TELEMETRY CONSOLE</span>
        </div>
      </div>

      {/* Center Hardware Telemetry VFD Display */}
      <div className="rack-center-gauges">
        <div className="hardware-vfd-display">
          <div className="vfd-screen">
            <span className="vfd-label">THEATRE CLOCK</span>
            <span className="vfd-value">{timeStr || "00:00:00"} <small>UTC</small></span>
          </div>
        </div>

        {/* Physical LED Status Array */}
        <div className="hardware-led-bank">
          <div className="led-indicator active">
            <span className="led-diode green" />
            <span className="led-tag">PWR</span>
          </div>
          <div className="led-indicator active">
            <span className="led-diode cyan" />
            <span className="led-tag">INF</span>
          </div>
          <div className="led-indicator active">
            <span className="led-diode amber" />
            <span className="led-tag">RSI-GUARD</span>
          </div>
        </div>
      </div>

      {/* Right Control Modules & Keycard Badge */}
      <div className="rack-right-controls">
        <nav className="mechanical-selector-bank">
          <button
            type="button"
            className={`mech-module-btn ${isLive ? "depressed" : ""}`}
            onClick={() => navigate("/live")}
          >
            <span className="mech-led green" />
            <span className="mech-key-label">01 // LIVE HUD</span>
          </button>

          {isAdmin && (
            <button
              type="button"
              className={`mech-module-btn ${isHistory ? "depressed" : ""}`}
              onClick={() => navigate("/history")}
            >
              <span className="mech-led cyan" />
              <span className="mech-key-label">02 // AUDIT LOGS</span>
            </button>
          )}
        </nav>

        {/* Tactile Keycard Reader / User Tag */}
        <div className="operator-key-badge">
          <div className="key-slot-bezel">
            <span className="key-slot-accent" />
          </div>
          <div className="operator-meta">
            <span className="operator-id">OP: {username.toUpperCase()}</span>
            <span className={`operator-role-badge ${isAdmin ? "supervisor" : "nurse"}`}>
              {isAdmin ? "SUPERVISOR (SEC-A)" : "CIRCULATOR (SEC-B)"}
            </span>
          </div>
        </div>

        {/* Physical Power/Eject Switch */}
        <button
          type="button"
          className="mech-eject-switch"
          title="Sign out / Disengage Console"
          onClick={() => {
            sessionStorage.clear();
            navigate("/");
          }}
        >
          <span className="switch-knob" />
          <span className="switch-text">DISENGAGE</span>
        </button>

        <div className="screw screw-tr">⊕</div>
      </div>
    </header>
  );
}

function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("nurse");
  const [password, setPassword] = useState("nurse123");
  const [error, setError] = useState("");
  const [authenticating, setAuthenticating] = useState(false);

  if (token()) return <Navigate to="/live" replace />;

  async function submit(event) {
    if (event) event.preventDefault();
    setError("");
    setAuthenticating(true);
    try {
      const result = await api("/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      sessionStorage.setItem("token", result.token);
      sessionStorage.setItem("role", result.role);
      sessionStorage.setItem("username", result.username);
      navigate("/live");
    } catch (err) {
      setError(err.message);
    } finally {
      setAuthenticating(false);
    }
  }

  function selectPersona(user, pass) {
    setUsername(user);
    setPassword(pass);
    setError("");
  }

  return (
    <div className="console-chassis station-unlock-layout">
      {/* Front Panel Chassis Box */}
      <div className="hardware-console-casing">
        {/* Corner Screws */}
        <div className="chassis-screw tl">⊕</div>
        <div className="chassis-screw tr">⊕</div>
        <div className="chassis-screw bl">⊕</div>
        <div className="chassis-screw br">⊕</div>

        {/* Machined Metal Header Plate */}
        <div className="chassis-header-plate">
          <div className="chassis-badge-left">
            <span className="laser-etch-title">SURG-TRACK 8000</span>
            <span className="laser-etch-sub">REAL-TIME SURGICAL INSTRUMENT TRACKING & STERILE HUD</span>
          </div>
          <div className="chassis-badge-right">
            <span className="chassis-serial">REF: ST-8000-AIM</span>
            <span className="chassis-spec">IEC 60601-1 COMPLIANT</span>
          </div>
        </div>

        {/* Physical Console Panel Body */}
        <form className="hardware-panel-surface" onSubmit={submit}>
          {/* Persona Switcher: Tactile Dual-Position Rocker Metaphor */}
          <div className="hardware-section">
            <div className="section-label-plate">
              <span className="plate-title">OPERATOR ACCESS LEVEL</span>
              <span className="plate-line" />
            </div>

            <div className="tactile-rocker-selector">
              <button
                type="button"
                className={`rocker-choice ${username === "nurse" ? "engaged" : ""}`}
                onClick={() => selectPersona("nurse", "nurse123")}
              >
                <span className="rocker-led-pill green" />
                <div className="rocker-text">
                  <strong className="rocker-role">CIRCULATING NURSE</strong>
                  <span className="rocker-desc">LIVE TELEMETRY HUD // REAL-TIME EVENT STREAM</span>
                </div>
              </button>

              <button
                type="button"
                className={`rocker-choice ${username === "admin" ? "engaged" : ""}`}
                onClick={() => selectPersona("admin", "admin123")}
              >
                <span className="rocker-led-pill amber" />
                <div className="rocker-text">
                  <strong className="rocker-role">SURGICAL SUPERVISOR</strong>
                  <span className="rocker-desc">FULL AUDIT ARCHIVE // CLINICAL PDF SIGN-OFF</span>
                </div>
              </button>
            </div>
          </div>

          {/* Credential Inset Bays */}
          <div className="hardware-section">
            <div className="section-label-plate">
              <span className="plate-title">AUTHENTICATION CREDENTIALS</span>
              <span className="plate-line" />
            </div>

            <div className="hardware-input-grid">
              <div className="recessed-field-bay">
                <label className="field-bezel-label">OPERATOR IDENTIFIER</label>
                <div className="recessed-input-well">
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="ENTER ID..."
                    className="hardware-input-mono"
                  />
                </div>
              </div>

              <div className="recessed-field-bay">
                <label className="field-bezel-label">SECURITY PASSCODE</label>
                <div className="recessed-input-well">
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••••"
                    className="hardware-input-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="hardware-fault-banner">
              <span className="fault-led" />
              <span className="fault-msg">FAULT: {error.toUpperCase()}</span>
            </div>
          )}

          {/* Heavy Tactile Push Button */}
          <button
            type="submit"
            className="hardware-momentary-btn"
            disabled={authenticating}
          >
            <span className="btn-mechanical-cap">
              <span className="btn-engrave-text">
                {authenticating ? "INITIALIZING SUBSYSTEMS..." : "[ ENGAGE CONSOLE // ENTER THEATRE ]"}
              </span>
            </span>
          </button>

          {/* Hardware Diagnostic Array Plates */}
          <div className="chassis-diagnostic-plate">
            <div className="diag-item">
              <span className="diag-lbl">DETECTION</span>
              <span className="diag-val">YOLOv8n (94.1% mAP)</span>
            </div>
            <div className="diag-item">
              <span className="diag-lbl">LATENCY</span>
              <span className="diag-val">~3.4 ms // 294 FPS</span>
            </div>
            <div className="diag-item">
              <span className="diag-lbl">TRACKING</span>
              <span className="diag-val">BYTETRACK-KF</span>
            </div>
            <div className="diag-item">
              <span className="diag-lbl">GESTURE</span>
              <span className="diag-val">3D-EUCLIDEAN</span>
            </div>
          </div>
        </form>

        {/* Chassis Footnote Plate */}
        <div className="chassis-bottom-plate">
          <span>GIET UNIVERSITY // MAJOR PROJECT — B.TECH CSE (AI & ML)</span>
          <span>STATION ID: OR-THEATRE-04</span>
        </div>
      </div>
    </div>
  );
}
