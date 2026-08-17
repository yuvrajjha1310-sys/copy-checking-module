import { useEffect, useState } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5050/api'

const STAGES = [
  { key: 'PENDING', label: 'Pending', color: 'var(--accent)' },
  { key: 'IN_REVIEW', label: 'In review', color: '#f59e0b' },
  { key: 'CHECKED', label: 'Checked', color: 'var(--teal)' },
  { key: 'RETURNED', label: 'Returned', color: '#8b5cf6' },
]

export default function StatsOverview() {
  const [counts, setCounts] = useState({})

  useEffect(() => {
    fetch(`${API_BASE}/submissions`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        const tally = {}
        for (const s of data) tally[s.status] = (tally[s.status] || 0) + 1
        setCounts(tally)
      })
      .catch(() => {})
  }, [])

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
      {STAGES.map((s, i) => (
        <div
          key={s.key}
          className="card-surface rounded-2xl p-5 animate-fade-up hover:-translate-y-0.5"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <div className="text-xs font-mono uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
            {s.label}
          </div>
          <div className="font-display text-4xl mt-1" style={{ color: s.color }}>
            {counts[s.key] || 0}
          </div>
        </div>
      ))}
    </div>
  )
}