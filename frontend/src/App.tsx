import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import LogPage from './pages/LogPage'
import Reports from './pages/Incidents'


function NotFoundPage() {
  return (
    <section className="rounded-2xl border border-rose-700/40 bg-rose-950/20 p-8">
      <h1 className="page-title text-4xl font-bold tracking-tight text-rose-200">404</h1>
      <p className="mt-4 text-rose-100/80">Page not found.</p>
    </section>
  )
}

function App() {
  return (
    <BrowserRouter>
      <main className="min-h-screen bg-zinc-950 text-zinc-100">
        <nav className="fixed inset-y-0 left-0 flex w-64 flex-col border-r border-zinc-900 bg-black px-4 py-6 shadow-[0_0_36px_rgba(0,0,0,0.45)]">
          <div className="px-3 pb-6 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Navigation
          </div>
          <NavLink
            to="/"
            className={({ isActive }) =>
              `mb-2 flex flex-row items-center gap-1 rounded-md border px-4 py-2 text-sm font-medium transition-colors ${isActive ? 'border-blue-500/30 bg-blue-500/20 text-blue-200' : 'border-transparent text-zinc-300 hover:border-zinc-800 hover:bg-zinc-900 hover:text-zinc-100'}`
            }
          >
            <i className="fa-solid fa-circle-exclamation"></i>
            Incidents
          </NavLink>

          <NavLink
            to="/traces"
            className={({ isActive }) =>
              `mb-2 flex flex-row items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors ${isActive ? 'border-emerald-500/30 bg-emerald-500/20 text-emerald-200' : 'border-transparent text-zinc-300 hover:border-zinc-800 hover:bg-zinc-900 hover:text-zinc-100'}`
            }
          >
            <i className="fa-solid fa-chart-line"></i>
            Traces
          </NavLink>
          
          <NavLink
            to="/logs"
            className={({ isActive }) =>
              `mb-2 flex flex-row items-center gap-1 rounded-md border px-4 py-2 text-sm font-medium transition-colors ${isActive ? 'border-violet-500/30 bg-violet-500/20 text-violet-300' : 'border-transparent text-zinc-300 hover:border-zinc-800 hover:bg-zinc-900 hover:text-zinc-100'}`
            }
          >
            <i className="fa-solid fa-scroll"></i>
            Logs
          </NavLink>
          
        </nav>
        <div className="ml-64 h-screen overflow-y-scroll bg-zinc-950/70 px-8 py-12">
          <Routes>
            <Route path="/traces" element={<Dashboard />} />
            <Route path="/" element={<Reports />} />
            <Route path="/logs" element={<LogPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </div>
      </main>
    </BrowserRouter>
  )
}

export default App
