import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, downloadPdf } from "./api";
import { eventLabel, labelFor } from "./labels";

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

  useEffect(() => {
    let ignore = false;
    const query = date ? `?date=${date}` : "";
    api(`/sessions${query}`)
      .then((data) => {
        if (!ignore) setRows(data);
      })
      .catch((err) => {
        if (!ignore) setError(err.message);
      });
    return () => {
      ignore = true;
    };
  }, [date]);

  return (
    <section className="panel wide">
      <div className="split">
        <h2>Past sessions</h2>
        <label>
          Date
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
      </div>
      {error && <p className="alert-banner">{error}</p>}
      {rows.length === 0 && <p className="muted">No sessions for this filter.</p>}
      {rows.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Id</th>
              <th>Name</th>
              <th>Started</th>
              <th>Ended</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.id}</td>
                <td>{row.name}</td>
                <td>{formatWhen(row.started_at)}</td>
                <td>{row.ended_at ? formatWhen(row.ended_at) : "Open"}</td>
                <td>
                  <button type="button" className="ghost" onClick={() => navigate(`/history/${row.id}`)}>
                    Open
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function SessionDetail({ id }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api(`/sessions/${id}`)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [id]);

  return (
    <section className="panel wide">
      <div className="split">
        <h2>{data ? data.session.name : "Session"}</h2>
        <div className="button-row">
          <button type="button" className="ghost" onClick={() => navigate("/history")}>
            Back
          </button>
          <button type="button" onClick={() => downloadPdf(id).catch((err) => setError(err.message))}>
            Download PDF
          </button>
        </div>
      </div>
      {error && <p className="alert-banner">{error}</p>}
      {data && (
        <>
          <p className="muted">
            {formatWhen(data.session.started_at)} to {data.session.ended_at ? formatWhen(data.session.ended_at) : "still open"}
          </p>
          <h3>Enter counts</h3>
          {data.summary.length === 0 && <p className="muted">No instruments entered.</p>}
          <ul className="summary">
            {data.summary.map((row) => (
              <li key={row.class} className={row.enter_count === 0 ? "zero-count" : ""}>
                <span>{labelFor(row.class)}</span>
                <strong>{row.enter_count}</strong>
              </li>
            ))}
          </ul>
          <h3>Events</h3>
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
              {data.events.map((row) => (
                <tr key={row.id}>
                  <td>{formatWhen(row.ts)}</td>
                  <td>{eventLabel(row.type)}</td>
                  <td>{labelFor(row.class_name)}</td>
                  <td>{row.track_id ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}

function formatWhen(value) {
  return String(value).replace("T", " ").replace("+00:00", " UTC");
}
