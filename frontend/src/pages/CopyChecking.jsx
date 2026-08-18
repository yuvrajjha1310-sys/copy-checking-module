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
  const [checkTarget, setCheckTarget] = useState(null); // submission being marked/reviewed
  const [editTarget, setEditTarget] = useState(null); // submission being edited
  const [showImport, setShowImport] = useState(false);

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

  async function handleEdit(id, form) {
    const res = await fetch(`${API_BASE}/submissions/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    await unwrap(res); // throws with the server's message on failure
    setEditTarget(null);
    load();
  }

  // ---- Copy attachment (the scanned PDF/photo) ----
  async function handleAttachCopy(id, file) {
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch(`${API_BASE}/submissions/${id}/copy`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      await unwrap(res);
      load();
      // Keep the review panel in sync if it's open on this submission.
      setCheckTarget((prev) => (prev && prev.id === id ? { ...prev, _copyUpdated: Date.now() } : prev));
    } catch (e) {
      setLoadError(e.message);
    }
  }

  async function handleRemoveCopy(id) {
    try {
      const res = await fetch(`${API_BASE}/submissions/${id}/copy`, {
        method: "DELETE",
        credentials: "include",
      });
      await unwrap(res);
      load();
    } catch (e) {
      setLoadError(e.message);
    }
  }

  // ---- Bulk import (CSV/Excel, multi-file) / CSV export ----
  async function handleImport(files) {
    const formData = new FormData();
    files.forEach((f) => formData.append("files", f));
    const res = await fetch(`${API_BASE}/submissions/import`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    const result = await unwrap(res); // { created, skippedCount, skipped, filesProcessed }
    load();
    return result;
  }

  async function handleExport() {
    try {
      const query = tab === "ALL" ? "" : `?status=${tab}`;
      const res = await fetch(`${API_BASE}/submissions/export${query}`, { credentials: "include" });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `submissions-${tab.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setLoadError(e.message);
    }
  }

  return (
    <div className="min-h-screen text-[var(--ink)]">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs tracking-widest uppercase text-[var(--accent)]/70 font-semibold mb-1">
              Module — Evaluation
            </p>
            <h1 className="text-3xl font-display text-[var(--ink)]">Copy &amp; Assignment Checking</h1>
            <p className="text-sm text-[var(--muted)] mt-1">
              Track submitted work from student desk to marked-and-returned.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowImport(true)}
              className="btn focus-ring rounded-md border border-[var(--border)] text-sm font-medium px-3 py-2 text-[var(--muted)] hover:text-[var(--ink)]"
            >
              Import CSV
            </button>
            <button
              onClick={handleExport}
              className="btn focus-ring rounded-md border border-[var(--border)] text-sm font-medium px-3 py-2 text-[var(--muted)] hover:text-[var(--ink)]"
            >
              Export CSV
            </button>
            <button
              onClick={() => setShowAddForm(true)}
              className="btn btn-primary focus-ring rounded-md bg-[var(--accent)] text-white text-sm font-medium px-4 py-2 hover:opacity-90"
            >
              + Log submission
            </button>
          </div>
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
                  <th className="px-4 py-3">Copy</th>
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
                      <td className="px-4 py-3">
                        <CopyCell
                          submission={s}
                          apiBase={API_BASE}
                          onAttach={(file) => handleAttachCopy(s.id, file)}
                          onRemove={() => handleRemoveCopy(s.id)}
                        />
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <button
                          onClick={() => setEditTarget(s)}
                          className="btn focus-ring text-xs font-medium text-[var(--muted)] hover:text-[var(--ink)] hover:underline rounded px-1"
                        >
                          Edit
                        </button>
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
        <ReviewModal
          submission={checkTarget}
          apiBase={API_BASE}
          onClose={() => setCheckTarget(null)}
          onSubmit={handleCheck}
        />
      )}
      {editTarget && (
        <EditModal submission={editTarget} onClose={() => setEditTarget(null)} onSubmit={handleEdit} />
      )}
      {showImport && (
        <ImportModal onClose={() => setShowImport(false)} onSubmit={handleImport} />
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
            <th className="px-4 py-3">Copy</th>
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
              <td className="px-4 py-3"><div className="skeleton h-3.5 w-12" /></td>
              <td className="px-4 py-3 text-right"><div className="skeleton h-3.5 w-14 ml-auto" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------- Copy attach / view / replace / remove (per row) ----------
function CopyCell({ submission, apiBase, onAttach, onRemove }) {
  const inputRef = useRef(null);
  const hasCopy = Boolean(submission.copyFilePath);
  const fileUrl = `${apiBase}/submissions/${submission.id}/copy`;

  function pickFile() {
    inputRef.current?.click();
  }

  function onFileChange(e) {
    const file = e.target.files?.[0];
    if (file) onAttach(file);
    e.target.value = ""; // allow re-selecting the same file later
  }

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={onFileChange}
      />
      {hasCopy ? (
        <>
          <a
            href={fileUrl}
            target="_blank"
            rel="noreferrer"
            className="btn focus-ring text-xs font-medium text-[var(--accent)] hover:underline rounded px-1"
          >
            View
          </a>
          <button onClick={pickFile} className="btn focus-ring text-xs text-[var(--muted)] hover:text-[var(--ink)] hover:underline rounded px-1">
            Replace
          </button>
          <button onClick={onRemove} className="btn focus-ring text-xs text-[var(--muted)] hover:text-[var(--ink)] hover:underline rounded px-1">
            Remove
          </button>
        </>
      ) : (
        <button onClick={pickFile} className="btn focus-ring text-xs font-medium text-[var(--teal)] hover:underline rounded px-1">
          Attach
        </button>
      )}
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

// ---------- Review panel: the scanned copy and the marks form, side by side ----------
function ReviewModal({ submission, apiBase, onClose, onSubmit }) {
  const { closing, requestClose } = useClosable(onClose);
  const [marks, setMarks] = useState(submission.marksObtained ?? "");
  const [remarks, setRemarks] = useState(submission.remarks ?? "");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const hasCopy = Boolean(submission.copyFilePath);
  const fileUrl = `${apiBase}/submissions/${submission.id}/copy`;
  const isImage = (submission.copyFileType || "").startsWith("image/");
  const isPdf = submission.copyFileType === "application/pdf";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className={`bg-white dark:bg-[#111111] border border-[var(--border)] rounded-lg shadow-xl w-full max-w-6xl h-[88vh] flex flex-col lg:flex-row overflow-hidden ${
          closing ? "animate-modal-out" : "animate-modal-in"
        }`}
      >
        {/* Left: the scanned copy, so marks can be entered without leaving the page */}
        <div className="flex-1 min-h-0 min-w-0 bg-[var(--muted)]/5 border-b lg:border-b-0 lg:border-r border-[var(--border)] flex flex-col">
          <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between shrink-0">
            <div className="min-w-0">
              <h2 className="font-display text-base text-[var(--ink)] truncate">{submission.studentName}</h2>
              <p className="text-xs text-[var(--muted)] truncate">
                {submission.studentRoll} · {submission.assignmentTitle}
              </p>
            </div>
            <button onClick={requestClose} className="btn focus-ring shrink-0 text-[var(--muted)] hover:text-[var(--ink)] text-sm rounded px-1.5 py-0.5">
              ✕
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-auto">
            {isPdf ? (
              <iframe title="Scanned copy" src={fileUrl} className="w-full h-full border-0" />
            ) : isImage ? (
              <img src={fileUrl} alt="Scanned copy" className="w-full h-auto" />
            ) : hasCopy ? (
              <div className="h-full flex items-center justify-center text-sm text-[var(--muted)] p-6 text-center">
                Can't preview this file type inline —{" "}
                <a href={fileUrl} target="_blank" rel="noreferrer" className="underline">
                  open it in a new tab
                </a>
                .
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-[var(--muted)] p-6 text-center">
                No copy attached yet. Close this and use "Attach" on the row, then reopen "Mark".
              </div>
            )}
          </div>
        </div>

        {/* Right: marks entry, right next to the copy */}
        <form onSubmit={handleSubmit} className="w-full lg:w-80 shrink-0 flex flex-col min-h-0">
          <div className="px-4 py-3 border-b border-[var(--border)] shrink-0">
            <h3 className="font-display text-sm text-[var(--ink)]">Enter marks</h3>
          </div>
          <div className="flex-1 min-h-0 overflow-auto p-4 space-y-3">
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
                rows={8}
                className="input-field focus-ring w-full rounded-md border border-[var(--border)] bg-transparent text-[var(--ink)] px-3 py-2 text-sm focus:outline-none"
              />
            </div>

            {error && (
              <p className="animate-toast-in text-sm text-[var(--accent)] bg-[var(--accent)]/10 border border-[var(--accent)]/30 rounded-md px-3 py-2">
                {error}
              </p>
            )}
          </div>
          <div className="p-4 border-t border-[var(--border)] flex justify-end gap-2 shrink-0">
            <button type="button" onClick={requestClose} className="btn focus-ring px-3 py-1.5 text-sm text-[var(--muted)] hover:text-[var(--ink)] rounded-md">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn btn-primary focus-ring px-3 py-1.5 text-sm rounded-md bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-60 flex items-center gap-2">
              {submitting && <span className="spinner" />}
              {submitting ? "Saving…" : "Save marks"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditModal({ submission, onClose, onSubmit }) {
  const { closing, requestClose } = useClosable(onClose);
  const [form, setForm] = useState({
    studentName: submission.studentName ?? "",
    studentRoll: submission.studentRoll ?? "",
    subject: submission.subject ?? "",
    assignmentTitle: submission.assignmentTitle ?? "",
    maxMarks: submission.maxMarks ?? 100,
    marksObtained: submission.marksObtained ?? "",
    remarks: submission.remarks ?? "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (form.marksObtained !== "" && Number(form.marksObtained) > Number(form.maxMarks)) {
      setError(`Marks can't exceed the maximum (${form.maxMarks}).`);
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(submission.id, form);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell title={`Edit — ${submission.studentName}`} onClose={requestClose} closing={closing}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="Student name" value={form.studentName} onChange={(v) => setForm({ ...form, studentName: v })} required />
        <Field label="Roll number" value={form.studentRoll} onChange={(v) => setForm({ ...form, studentRoll: v })} required />
        <Field label="Subject" value={form.subject} onChange={(v) => setForm({ ...form, subject: v })} required />
        <Field label="Assignment title" value={form.assignmentTitle} onChange={(v) => setForm({ ...form, assignmentTitle: v })} required />
        <Field label="Max marks" type="number" value={form.maxMarks} onChange={(v) => setForm({ ...form, maxMarks: v })} required />
        <Field label="Marks obtained" type="number" value={form.marksObtained} onChange={(v) => setForm({ ...form, marksObtained: v })} />
        <div>
          <label className="block text-xs font-medium text-[var(--muted)] mb-1">Remarks</label>
          <textarea
            value={form.remarks}
            onChange={(e) => setForm({ ...form, remarks: e.target.value })}
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
            {submitting ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ---------- CSV/Excel bulk import ----------
const IMPORT_ACCEPT = ".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel";
const IMPORT_TEMPLATE = "studentName,studentRoll,subject,assignmentTitle,maxMarks\nJohn Doe,21,Mathematics,Chapter 4 Worksheet,50\n";

function ImportModal({ onClose, onSubmit }) {
  const { closing, requestClose } = useClosable(onClose);
  const [files, setFiles] = useState([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { created, skippedCount, skipped, filesProcessed }

  function downloadTemplate() {
    const blob = new Blob([IMPORT_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "submissions-template.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (files.length === 0) {
      setError("Choose at least one CSV or Excel file.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await onSubmit(files);
      setResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell title="Import submissions" onClose={requestClose} closing={closing}>
      {result ? (
        <div className="space-y-3">
          <p className="text-sm text-[var(--ink)]">
            Processed <span className="font-medium">{result.filesProcessed}</span> file{result.filesProcessed === 1 ? "" : "s"} —
            created <span className="font-medium">{result.created}</span> submission{result.created === 1 ? "" : "s"}.
            {result.skippedCount > 0 && (
              <> Skipped <span className="font-medium">{result.skippedCount}</span> row{result.skippedCount === 1 ? "" : "s"}.</>
            )}
          </p>
          {result.skippedCount > 0 && (
            <ul className="max-h-40 overflow-auto text-xs text-[var(--muted)] space-y-1 border border-[var(--border)] rounded-md p-2">
              {result.skipped.map((s, i) => (
                <li key={i}>{s.file} — row {s.row}: {s.reason}</li>
              ))}
            </ul>
          )}
          <div className="flex justify-end pt-2">
            <button onClick={requestClose} className="btn btn-primary focus-ring px-3 py-1.5 text-sm rounded-md bg-[var(--accent)] text-white hover:opacity-90">
              Done
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <p className="text-xs text-[var(--muted)]">
            CSV or Excel (.xlsx/.xls) — select multiple to import several class lists at once.
            Columns: studentName, studentRoll, subject, assignmentTitle, maxMarks (optional, defaults to 100).{" "}
            <button type="button" onClick={downloadTemplate} className="underline">
              Download a CSV template
            </button>
          </p>
          <input
            type="file"
            multiple
            accept={IMPORT_ACCEPT}
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            className="input-field focus-ring w-full rounded-md border border-[var(--border)] bg-transparent text-[var(--ink)] px-3 py-2 text-sm focus:outline-none"
          />
          {files.length > 0 && (
            <ul className="text-xs text-[var(--muted)] space-y-0.5">
              {files.map((f, i) => <li key={i}>{f.name}</li>)}
            </ul>
          )}

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
              {submitting ? "Importing…" : "Import"}
            </button>
          </div>
        </form>
      )}
    </ModalShell>
  );
}

function ModalShell({ title, onClose, closing, children }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-50">
      <div className={`bg-white dark:bg-[#111111] border border-[var(--border)] rounded-lg shadow-xl w-full max-w-sm p-5 ${closing ? "animate-modal-out" : "animate-modal-in"}`}>
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
