import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import LogPage from './pages/LogPage'
import Reports from './pages/Incidents'


function NotFoundPage() {
  return (
    <section className="rounded-2xl border border-rose-700/40 bg-rose-950/20 p-8">
      <h1 className="text-4xl font-bold tracking-tight text-rose-200">404</h1>
      <p className="mt-4 text-rose-100/80">Page not found.</p>
    </section>
  )
}

function App() {
  return (
    <BrowserRouter>
      <main className="flex min-h-screen bg-zinc-950 text-zinc-100">
        <nav className="flex min-h-screen w-64 flex-col border-r border-zinc-900 bg-black px-4 py-6 shadow-[0_0_36px_rgba(0,0,0,0.45)]">
          <div className="px-3 pb-6 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Navigation
          </div>
          <NavLink
            to="/"
            className={({ isActive }) =>
              `flex flex-row items-center gap-2 rounded-md border px-4 py-2 mb-2 text-sm font-medium transition-colors ${isActive ? 'border-cyan-500/30 bg-cyan-500/20 text-cyan-200' : 'border-transparent text-zinc-300 hover:border-zinc-800 hover:bg-zinc-900 hover:text-zinc-100'}`
            }
          >
            <i className="fa-solid fa-chart-line"></i>
            Dashboard
          </NavLink>
          <NavLink
            to="/reports"
            className={({ isActive }) =>
              `flex flex-row items-center gap-1 mb-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors ${isActive ? 'border-cyan-500/30 bg-cyan-500/20 text-cyan-200' : 'border-transparent text-zinc-300 hover:border-zinc-800 hover:bg-zinc-900 hover:text-zinc-100'}`
            }
          >
            <i className="fa-solid fa-circle-exclamation"></i>
            Reports
          </NavLink>
          <NavLink
            to="/logs"
            className={({ isActive }) =>
              `flex flex-row items-center gap-1 mb-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors ${isActive ? 'border-cyan-500/30 bg-cyan-500/20 text-cyan-200' : 'border-transparent text-zinc-300 hover:border-zinc-800 hover:bg-zinc-900 hover:text-zinc-100'}`
            }
          >
            <i className="fa-solid fa-scroll"></i>
            Logs
          </NavLink>
        </nav>
        <div className="flex-1 bg-zinc-950/70 px-8 py-12">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/logs" element={<LogPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </div>
      </main>
    </BrowserRouter>
  )
}

export default App
