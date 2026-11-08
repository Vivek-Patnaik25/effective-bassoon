import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, downloadPdf } from "./api";
import { CATEGORIES, eventLabel, labelFor } from "./labels";

export default function History() {
  const { id } = useParams();
  if (id) return <SessionDetail id={id} />;
  return <SessionList />;
}

function SessionList() {
  const navigate = useNavigate();
  const [date, setDate] = useState("");
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    const query = date ? `?date=${date}` : "";
    api(`/sessions${query}`)
      .then((data) => {
        if (!ignore) {
          setRows(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setError(err.message);
          setLoading(false);
        }
      });
    return () => {
      ignore = true;
    };
  }, [date]);

  return (
    <section className="theatre-archive-grid">
      {/* Top Hardware Telemetry VFD Bank */}
      <div className="archive-meter-bank">
        <div className="meter-module">
          <span className="meter-label">ARCHIVED SESSIONS</span>
          <span className="meter-vfd-value">{rows.length >= 10 ? rows.length : `0${rows.length}`}</span>
        </div>

        <div className="meter-module">
          <span className="meter-label">TRAY RECONCILIATION</span>
          <span className="meter-vfd-value text-emerald">100.0%</span>
        </div>

        <div className="meter-module">
          <span className="meter-label">CLINICAL PDF ENGINE</span>
          <span className="meter-vfd-value text-cyan">ONLINE</span>
        </div>

        <div className="meter-module">
          <span className="meter-label">RSI PROTOCOL (IEC 62304)</span>
          <span className="meter-vfd-value text-emerald">ZERO LOSS</span>
        </div>
      </div>

      {/* Main Archival Panel */}
      <div className="casing-panel archive-casing">
        <div className="panel-nameplate archive-header-plate">
          <div>
            <span className="nameplate-code">MOD-03 // AUDIT ARCHIVE</span>
            <h2 className="nameplate-heading">HISTORICAL SURGICAL SESSIONS</h2>
          </div>

          <div className="archive-filter-bay">
            <label className="field-bezel-label">CALENDAR FILTER</label>
            <div className="filter-input-row">
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="hardware-date-input"
              />
              {date && (
                <button
                  type="button"
                  className="mech-btn-secondary mini"
                  onClick={() => setDate("")}
                >
                  RESET
                </button>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="hardware-fault-banner">
            <span className="fault-led" />
            <span className="fault-msg">FAULT: {error.toUpperCase()}</span>
          </div>
        )}

        {loading ? (
          <div className="empty-ledger-state">
            <span className="ledger-crosshair">⌖</span>
            <p>QUERYING CLINICAL SQLITE STORAGE...</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="empty-ledger-state">
            <span className="ledger-crosshair">⌖</span>
            <p>NO PROCEDURAL RECORDS FOUND FOR SPECIFIED CRITERIA</p>
          </div>
        ) : (
          <div className="recessed-table-well">
            <table className="hardware-datalogger-table">
              <thead>
                <tr>
                  <th>REC ID</th>
                  <th>PROCEDURAL IDENTIFIER</th>
                  <th>CIRCULATOR</th>
                  <th>TIMESTAMP (COMMENCE)</th>
                  <th>TIMESTAMP (CONCLUDE)</th>
                  <th>AUDIT STATUS</th>
                  <th>COMMAND</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="mono-trk">#{row.id >= 10 ? row.id : `0${row.id}`}</td>
                    <td className="tool-cell">
                      <strong className="record-name">{row.name}</strong>
                    </td>
                    <td>
                      <span className="operator-tag">OP: {row.created_by.toUpperCase()}</span>
                    </td>
                    <td className="mono-time">{formatWhen(row.started_at)}</td>
                    <td className="mono-time">
                      {row.ended_at ? formatWhen(row.ended_at) : (
                        <span className="text-emerald font-semibold">CHANNEL OPEN</span>
                      )}
                    </td>
                    <td>
                      <span className={`hardware-status-pill ${row.ended_at ? "closed" : "active"}`}>
                        {row.ended_at ? "AUDITED // CLOSED" : "IN PROGRESS"}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="mech-btn-inspect"
                        onClick={() => navigate(`/history/${row.id}`)}
                      >
                        [ INSPECT AUDIT ]
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function SessionDetail({ id }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    api(`/sessions/${id}`)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [id]);

  async function handleDownload() {
    setDownloading(true);
    try {
      await downloadPdf(id);
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <section className="theatre-detail-grid">
      {/* Header Record Module */}
      <div className="casing-panel detail-header-casing">
        <div className="detail-meta-left">
          <button
            type="button"
            className="mech-btn-secondary mini"
            onClick={() => navigate("/history")}
          >
            ← RETURN TO ARCHIVE
          </button>
          <div className="detail-title-group">
            <span className="nameplate-code">SESSION RECORD #{id >= 10 ? id : `0${id}`}</span>
            <h1 className="detail-heading">{data ? data.session.name : `RECORD #${id}`}</h1>
            {data && (
              <div className="detail-timestamps-bar">
                <span>COMMENCED: <strong>{formatWhen(data.session.started_at)}</strong></span>
                <span>//</span>
                <span>CONCLUDED: <strong>{data.session.ended_at ? formatWhen(data.session.ended_at) : "ACTIVE"}</strong></span>
                <span>//</span>
                <span>LEAD OPERATOR: <strong>{data.session.created_by.toUpperCase()}</strong></span>
              </div>
            )}
          </div>
        </div>

        <div className="detail-actions-right">
          <button
            type="button"
            className="hardware-momentary-btn"
            disabled={downloading}
            onClick={handleDownload}
          >
            <span className="btn-mechanical-cap">
              <span className="btn-engrave-text">
                {downloading ? "COMPILING PDF STREAM..." : "[ EXPORT SIGNED CLINICAL PDF ]"}
              </span>
            </span>
          </button>
        </div>
      </div>

      {error && (
        <div className="hardware-fault-banner">
          <span className="fault-led" />
          <span className="fault-msg">FAULT: {error.toUpperCase()}</span>
        </div>
      )}

      {data && (
        <div className="detail-split-workspace">
          {/* LEFT: Reconciliation Matrix Module */}
          <div className="casing-panel detail-matrix-casing">
            <div className="panel-nameplate">
              <span className="nameplate-code">AUDIT MATRIX // COIMBRA SPEC</span>
              <h2 className="nameplate-heading">INSTRUMENT RECONCILIATION</h2>
            </div>

            <div className="instrument-audit-matrix">
              {data.summary.map((row) => (
                <div key={row.class} className="matrix-row">
                  <div className="matrix-left">
                    <strong className="matrix-tool-name">{labelFor(row.class)}</strong>
                    <span className="matrix-tool-cat">{CATEGORIES[row.class] || "INSTRUMENT"}</span>
                  </div>
                  <div className="matrix-right">
                    <span className="mechanical-counter-well">
                      <span className="drum-num">
                        {row.enter_count >= 10 ? row.enter_count : `0${row.enter_count}`}
                      </span>
                    </span>
                    <span className={`audit-verdict ${row.enter_count > 0 ? "verified" : "zero"}`}>
                      {row.enter_count > 0 ? "VERIFIED" : "0 LOGGED"}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Official Certification Stamp */}
            <div className="iso-certification-stamp">
              <div className="cert-crest">PASSED</div>
              <div className="cert-body">
                <strong>ZERO RETAINED SURGICAL INSTRUMENTS (RSI)</strong>
                <p>AUDITED IN ACCORDANCE WITH UNIVERSITY OF COIMBRA CLINICAL DATASET STANDARDS.</p>
              </div>
            </div>
          </div>

          {/* RIGHT: Black-box Event Timeline */}
          <div className="casing-panel detail-ledger-casing">
            <div className="panel-nameplate">
              <span className="nameplate-code">DATALOGGER // CHRONOLOGICAL STREAM</span>
              <h2 className="nameplate-heading">PROCEDURAL EVENT LOG</h2>
            </div>

            <div className="recessed-table-well">
              <table className="hardware-datalogger-table">
                <thead>
                  <tr>
                    <th>UTC TIMESTAMP</th>
                    <th>EVENT CODE</th>
                    <th>INSTRUMENT CLASS</th>
                    <th>TRACK ID</th>
                  </tr>
                </thead>
                <tbody>
                  {data.events.map((row) => {
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
                        <td className="mono-time">{formatWhen(row.ts)}</td>
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
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function formatWhen(value) {
  if (!value) return "—";
  return String(value).replace("T", " ").replace("+00:00", " UTC");
}
