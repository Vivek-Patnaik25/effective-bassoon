import { useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
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
    <div className="app">
      <Topbar />
      <main>{children}</main>
    </div>
  );
}

function Topbar() {
  const navigate = useNavigate();
  const isAdmin = role() === "admin";
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">Operating theatre log</p>
        <strong>Surgical tool tracking</strong>
      </div>
      <nav>
        <button type="button" onClick={() => navigate("/live")}>Live</button>
        {isAdmin && (
          <button type="button" onClick={() => navigate("/history")}>History</button>
        )}
        <button
          type="button"
          className="ghost"
          onClick={() => {
            sessionStorage.clear();
            navigate("/");
          }}
        >
          Sign out
        </button>
      </nav>
    </header>
  );
}

function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("nurse");
  const [password, setPassword] = useState("nurse123");
  const [error, setError] = useState("");

  if (token()) return <Navigate to="/live" replace />;

  async function submit(event) {
    event.preventDefault();
    setError("");
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
    }
  }

  return (
    <div className="login-wrap">
      <form className="panel login" onSubmit={submit}>
        <p className="eyebrow">Hands-free instrument log</p>
        <h1>Sign in</h1>
        <p className="muted">
          Nurse sees the live session. Admin also opens history and the PDF.
        </p>
        <label>
          Username
          <input value={username} onChange={(event) => setUsername(event.target.value)} />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error && <p className="alert-banner">{error}</p>}
        <button type="submit">Enter theatre</button>
        <p className="muted small">nurse / nurse123 · admin / admin123</p>
      </form>
    </div>
  );
}
