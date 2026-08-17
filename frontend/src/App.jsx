import CopyChecking from './pages/CopyChecking'
import Login from './pages/Login'
import ThemeToggle from './components/ThemeToggle'
import StatsOverview from './components/StatsOverview'
import { AuthProvider, useAuth } from './context/AuthContext'

function AppShell() {
  const { user, loading, logout } = useAuth()

  return (
    <div className="relative min-h-screen">
      <div className="aurora">
        <span className="a1" />
        <span className="a2" />
      </div>

      <div className="fixed top-6 right-6 z-20 flex items-center gap-3">
        {user && (
          <div className="animate-fade-up flex items-center gap-2 card-surface rounded-full pl-3 pr-1 py-1">
            <span className="text-xs font-medium text-[var(--ink)]">{user.name}</span>
            <button
              onClick={logout}
              className="btn focus-ring text-xs text-[var(--muted)] hover:text-[var(--ink)] rounded-full px-2 py-1"
            >
              Sign out
            </button>
          </div>
        )}
        <ThemeToggle />
      </div>

      {loading ? (
        <div className="min-h-screen flex items-center justify-center">
          <span className="spinner text-[var(--accent)] text-2xl" />
        </div>
      ) : user ? (
        <div key="app" className="relative z-10 max-w-5xl mx-auto px-6 py-10 animate-page-in">
          <StatsOverview />
          <CopyChecking />
        </div>
      ) : (
        <div key="login" className="animate-page-in">
          <Login />
        </div>
      )}
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  )
}

export default App
