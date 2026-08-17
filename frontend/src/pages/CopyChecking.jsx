import { useEffect, useLayoutEffect, useRef, useState } from "react";

// Point this at wherever the merged backend ends up living.
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5050/api";

const STATUS_STYLES = {
  PENDING: {
    label: "Pending",
    dot: "bg-amber-500",
    chip: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30",
  },
  IN_REVIEW: {
    label: "In review",
    dot: "bg-sky-500",
    chip: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/30",
  },
  CHECKED: {
    label: "Checked",
    dot: "bg-emerald-500",
    chip: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30",
  },
  RETURNED: {
    label: "Returned",
    dot: "bg-slate-500",
    chip: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-400/10 dark:text-slate-300 dark:border-slate-400/30",
  },
};

const TABS = ["ALL", "PENDING", "IN_REVIEW", "CHECKED", "RETURNED"];

// Parses a fetch Response into a thrown Error with the server's message when
// the request failed, so callers can just try/catch and show err.message.
async function unwrap(res) {
  if (res.ok) {
    if (res.status === 204) return null;
    return res.json();
  }
  let message = `Request failed (${res.status})`;
  try {
    const data = await res.json();
    if (data?.error) message = data.error;
  } catch {
    // response had no JSON body — keep the generic message
  }
  throw new Error(message);
}

export default function CopyChecking() {
  const [submissions, setSubmissions] = useState([]);
  const [tab, setTab] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [checkTarget, setCheckTarget] = useState(null); // submission being marked

  async function load() {
    setLoading(true);
    setLoadError("");
    try {
      const query = tab === "ALL" ? "" : `?status=${tab}`;
      const res = await fetch(`${API_BASE}/submissions${query}`, { credentials: "include" });
      const data = await unwrap(res);
      setSubmissions(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Failed to load submissions", e);
      setSubmissions([]);
      setLoadError("Couldn't reach the server — check that the backend is running.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function handleAdd(form) {
    const res = await fetch(`${API_BASE}/submissions`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    await unwrap(res); // throws with the server's message on failure
    setShowAddForm(false);
    load();
  }

  async function handleAssign(id) {
    try {
      const res = await fetch(`${API_BASE}/submissions/${id}/assign`, {
        method: "PATCH",
        credentials: "include",
      });
      await unwrap(res);
      load();
    } catch (e) {
      setLoadError(e.message);
    }
  }

  async function handleCheck(id, marksObtained, remarks) {
    const res = await fetch(`${API_BASE}/submissions/${id}/check`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ marksObtained: Number(marksObtained), remarks }),
    });
    await unwrap(res); // throws with the server's message on failure
    setCheckTarget(null);
    load();
  }

  async function handleReturn(id) {
    try {
      const res = await fetch(`${API_BASE}/submissions/${id}/return`, {
        method: "PATCH",
        credentials: "include",
      });
      await unwrap(res);
      load();
    } catch (e) {
      setLoadError(e.message);
    }
  }

  return (
    <div className="min-h-screen text-[var(--ink)]">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <header className="mb-8 flex items-start justify-between">
          <div>
            <p className="text-xs tracking-widest uppercase text-[var(--accent)]/70 font-semibold mb-1">
              Module — Evaluation
            </p>
            <h1 className="text-3xl font-display text-[var(--ink)]">Copy &amp; Assignment Checking</h1>
            <p className="text-sm text-[var(--muted)] mt-1">
              Track submitted work from student desk to marked-and-returned.
            </p>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="btn btn-primary focus-ring shrink-0 rounded-md bg-[var(--accent)] text-white text-sm font-medium px-4 py-2 hover:opacity-90"
          >
            + Log submission
          </button>
        </header>

        <Toast message={loadError} onRetry={load} />

        <TabBar tab={tab} onChange={setTab} />

        {loading ? (
          <SkeletonTable />
        ) : submissions.length === 0 ? (
          <div className="animate-fade-up rounded-lg border border-dashed border-[var(--border)] py-16 text-center">
            <p className="text-[var(--muted)] text-sm">Nothing here yet — log a submission to get started.</p>
          </div>
        ) : (
          <div className="rounded-lg overflow-hidden card-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-[var(--muted)] border-b border-[var(--border)]">
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Assignment</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Checker</th>
                  <th className="px-4 py-3">Marks</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {submissions.map((s, i) => {
                  const style = STATUS_STYLES[s.status];
                  return (
                    <tr
                      key={s.id}
                      className="animate-row-in hover:bg-[var(--muted)]/10 transition-colors"
                      style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium font-mono text-[var(--ink)]">{s.studentName}</div>
                        <div className="text-xs font-mono text-[var(--muted)]">{s.studentRoll}</div>
                      </td>
                      <td className="px-4 py-3 text-[var(--ink)]">{s.assignmentTitle}</td>
                      <td className="px-4 py-3 text-[var(--muted)]">{s.subject}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors ${style.chip}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                          {style.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[var(--muted)]">{s.checkerName || "—"}</td>
                      <td className="px-4 py-3 font-mono text-[var(--ink)]">
                        {s.marksObtained != null ? `${s.marksObtained}/${s.maxMarks}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        {s.status === "PENDING" && (
                          <button
                            onClick={() => handleAssign(s.id)}
                            className="btn focus-ring text-xs font-medium text-[var(--teal)] hover:underline rounded px-1"
                          >
                            Pick up
                          </button>
                        )}
                        {(s.status === "IN_REVIEW" || s.status === "PENDING") && (
                          <button
                            onClick={() => setCheckTarget(s)}
                            className="btn focus-ring text-xs font-medium text-[var(--accent)] hover:underline rounded px-1"
                          >
                            Mark
                          </button>
                        )}
                        {s.status === "CHECKED" && (
                          <button
                            onClick={() => handleReturn(s.id)}
                            className="btn focus-ring text-xs font-medium text-[var(--muted)] hover:text-[var(--ink)] hover:underline rounded px-1"
                          >
                            Return to student
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAddForm && (
        <AddSubmissionModal onClose={() => setShowAddForm(false)} onSubmit={handleAdd} />
      )}
      {checkTarget && (
        <CheckModal submission={checkTarget} onClose={() => setCheckTarget(null)} onSubmit={handleCheck} />
      )}
    </div>
  );
}

// ---------- Sliding-indicator tab bar ----------
function TabBar({ tab, onChange }) {
  const containerRef = useRef(null);
  const btnRefs = useRef({});
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  useLayoutEffect(() => {
    const el = btnRefs.current[tab];
    const container = containerRef.current;
    if (el && container) {
      const elRect = el.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      setIndicator({ left: elRect.left - containerRect.left, width: elRect.width });
    }
  }, [tab]);

  return (
    <nav ref={containerRef} className="relative flex gap-1 mb-6 border-b border-[var(--border)]">
      {TABS.map((t) => (
        <button
          key={t}
          ref={(el) => (btnRefs.current[t] = el)}
          onClick={() => onChange(t)}
          className={`btn focus-ring px-3 py-2 text-sm font-medium -mb-px ${
            tab === t ? "text-[var(--accent)]" : "text-[var(--muted)] hover:text-[var(--ink)]"
          }`}
        >
          {t === "ALL" ? "All" : STATUS_STYLES[t].label}
        </button>
      ))}
      <span
        className="tab-indicator absolute bottom-0 h-0.5 bg-[var(--accent)]"
        style={{ transform: `translateX(${indicator.left}px)`, width: `${indicator.width}px` }}
      />
    </nav>
  );
}

// ---------- Animated dismissible error banner ----------
function Toast({ message, onRetry }) {
  const [shown, setShown] = useState("");
  const [closing, setClosing] = useState(false);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (message) {
      setShown(message);
      setClosing(false);
    } else if (shown) {
      setClosing(true);
      timeoutRef.current = setTimeout(() => setShown(""), 250);
    }
    return () => clearTimeout(timeoutRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message]);

  if (!shown) return null;

  return (
    <div
      className={`mb-6 rounded-md border border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[var(--accent)] text-sm px-4 py-3 flex items-center justify-between gap-3 ${
        closing ? "animate-toast-out" : "animate-toast-in"
      }`}
    >
      <span>{shown}</span>
      <button onClick={onRetry} className="btn focus-ring text-xs font-medium underline shrink-0 rounded px-1">
        Retry
      </button>
    </div>
  );
}

// ---------- Skeleton loading state ----------
function SkeletonTable() {
  return (
    <div className="rounded-lg overflow-hidden card-surface animate-fade-up">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-[var(--muted)] border-b border-[var(--border)]">
            <th className="px-4 py-3">Student</th>
            <th className="px-4 py-3">Assignment</th>
            <th className="px-4 py-3">Subject</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Checker</th>
            <th className="px-4 py-3">Marks</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {[0, 1, 2, 3, 4].map((i) => (
            <tr key={i}>
              <td className="px-4 py-3">
                <div className="skeleton h-3.5 w-24 mb-1.5" />
                <div className="skeleton h-2.5 w-14" />
              </td>
              <td className="px-4 py-3"><div className="skeleton h-3.5 w-32" /></td>
              <td className="px-4 py-3"><div className="skeleton h-3.5 w-20" /></td>
              <td className="px-4 py-3"><div className="skeleton h-5 w-20 rounded-full" /></td>
              <td className="px-4 py-3"><div className="skeleton h-3.5 w-16" /></td>
              <td className="px-4 py-3"><div className="skeleton h-3.5 w-12" /></td>
              <td className="px-4 py-3 text-right"><div className="skeleton h-3.5 w-14 ml-auto" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------- Modal with animated enter/exit ----------
function useClosable(onClose) {
  const [closing, setClosing] = useState(false);
  function requestClose() {
    setClosing(true);
    setTimeout(onClose, 200);
  }
  return { closing, requestClose };
}

function AddSubmissionModal({ onClose, onSubmit }) {
  const { closing, requestClose } = useClosable(onClose);
  const [form, setForm] = useState({
    studentName: "",
    studentRoll: "",
    subject: "",
    assignmentTitle: "",
    maxMarks: 100,
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell title="Log a new submission" onClose={requestClose} closing={closing}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="Student name" value={form.studentName} onChange={(v) => setForm({ ...form, studentName: v })} required />
        <Field label="Roll number" value={form.studentRoll} onChange={(v) => setForm({ ...form, studentRoll: v })} required />
        <Field label="Subject" value={form.subject} onChange={(v) => setForm({ ...form, subject: v })} required />
        <Field label="Assignment title" value={form.assignmentTitle} onChange={(v) => setForm({ ...form, assignmentTitle: v })} required />
        <Field label="Max marks" type="number" value={form.maxMarks} onChange={(v) => setForm({ ...form, maxMarks: v })} />

        {error && (
          <p className="animate-toast-in text-sm text-[var(--accent)] bg-[var(--accent)]/10 border border-[var(--accent)]/30 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={requestClose} className="btn focus-ring px-3 py-1.5 text-sm text-[var(--muted)] hover:text-[var(--ink)] rounded-md">
            Cancel
          </button>
          <button type="submit" disabled={submitting} className="btn btn-primary focus-ring px-3 py-1.5 text-sm rounded-md bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-60 flex items-center gap-2">
            {submitting && <span className="spinner" />}
            {submitting ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function CheckModal({ submission, onClose, onSubmit }) {
  const { closing, requestClose } = useClosable(onClose);
  const [marks, setMarks] = useState(submission.marksObtained ?? "");
  const [remarks, setRemarks] = useState(submission.remarks ?? "");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const numericMarks = Number(marks);
    if (marks === "" || Number.isNaN(numericMarks) || numericMarks < 0) {
      setError("Enter a valid, non-negative number of marks.");
      return;
    }
    if (numericMarks > submission.maxMarks) {
      setError(`Marks can't exceed the maximum (${submission.maxMarks}).`);
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(submission.id, marks, remarks);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell title={`Mark — ${submission.studentName}`} onClose={requestClose} closing={closing}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field
          label={`Marks (out of ${submission.maxMarks})`}
          type="number"
          value={marks}
          onChange={setMarks}
          required
        />
        <div>
          <label className="block text-xs font-medium text-[var(--muted)] mb-1">Remarks</label>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={3}
            className="input-field focus-ring w-full rounded-md border border-[var(--border)] bg-transparent text-[var(--ink)] px-3 py-2 text-sm focus:outline-none"
          />
        </div>

        {error && (
          <p className="animate-toast-in text-sm text-[var(--accent)] bg-[var(--accent)]/10 border border-[var(--accent)]/30 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={requestClose} className="btn focus-ring px-3 py-1.5 text-sm text-[var(--muted)] hover:text-[var(--ink)] rounded-md">
            Cancel
          </button>
          <button type="submit" disabled={submitting} className="btn btn-primary focus-ring px-3 py-1.5 text-sm rounded-md bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-60 flex items-center gap-2">
            {submitting && <span className="spinner" />}
            {submitting ? "Saving…" : "Save marks"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function ModalShell({ title, onClose, closing, children }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-50">
      <div className={`bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-xl w-full max-w-sm p-5 backdrop-blur-md ${closing ? "animate-modal-out" : "animate-modal-in"}`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg text-[var(--ink)]">{title}</h2>
          <button onClick={onClose} className="btn focus-ring text-[var(--muted)] hover:text-[var(--ink)] text-sm rounded px-1.5 py-0.5">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required = false }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[var(--muted)] mb-1">{label}</label>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="input-field focus-ring w-full rounded-md border border-[var(--border)] bg-transparent text-[var(--ink)] px-3 py-2 text-sm focus:outline-none"
      />
    </div>
  );
}
