import { useEffect, useState } from 'react'

export default function ThemeToggle() {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('theme')
    if (saved) return saved === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  return (
    <button
      onClick={() => setDark(!dark)}
      aria-label={dark ? 'Switch to day mode' : 'Switch to night mode'}
      className="btn focus-ring h-10 w-10 rounded-full border flex items-center justify-center overflow-hidden hover:scale-105"
      style={{
        borderColor: 'var(--border)',
        background: 'var(--surface)',
        boxShadow: dark ? '0 0 18px 2px rgba(255,93,125,0.35)' : 'none',
      }}
    >
      <span key={dark ? 'moon' : 'sun'} className="text-lg animate-form-swap inline-block">
        {dark ? '🌙' : '☀️'}
      </span>
    </button>
  )
}