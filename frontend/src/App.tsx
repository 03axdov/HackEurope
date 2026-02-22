import { useState } from 'react'
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <BrowserRouter>
      <main className="min-h-screen bg-zinc-950 text-zinc-100">
        <nav
          className={`fixed inset-y-0 left-0 z-20 flex flex-col border-r border-zinc-900 bg-black py-6 shadow-[0_0_36px_rgba(0,0,0,0.45)] transition-all duration-200 ${
            sidebarCollapsed ? 'w-20 px-2' : 'w-64 px-4'
          }`}
        >
          <button
            type="button"
            onClick={() => setSidebarCollapsed((prev) => !prev)}
            className="cursor-pointer absolute top-1/2 -right-2.5 flex h-20 w-5 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-300 shadow-[0_8px_24px_rgba(0,0,0,0.45)] transition hover:bg-zinc-800 hover:text-zinc-100"
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <i
              className={`fa-solid fa-chevron-left text-[10px] leading-none transition-transform ${
                sidebarCollapsed ? 'rotate-180' : ''
              }`}
            ></i>
          </button>

          <div className={`flex items-center ${sidebarCollapsed ? 'justify-center pb-4' : 'px-3 pb-6'}`}>
            <div className="flex flex-row gap-2 items-center text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">
              <img className="h-5 w-5 shrink-0" src="images/logo.webp" />
              {!sidebarCollapsed ? (
                <span className="bg-linear-to-r from-blue-300 via-blue-400 to-violet-400 bg-clip-text text-transparent">
                  Optimera
                </span>
              ) : null}
            </div>
          </div>
          <NavLink
            to="/"
            className={({ isActive }) =>
              `mb-2 flex items-center rounded-md border py-2 text-sm font-medium transition-colors ${
                sidebarCollapsed ? 'justify-center px-2' : 'gap-2 px-4'
              } ${isActive ? 'border-blue-500/30 bg-blue-500/20 text-blue-200' : 'border-transparent text-zinc-300 hover:border-zinc-800 hover:bg-zinc-900 hover:text-zinc-100'}`
            }
            title={sidebarCollapsed ? 'Dashboard' : undefined}
          >
            <span className="inline-flex h-5 w-5 items-center justify-center leading-none">
              <i className="fa-solid fa-chart-column text-sm leading-none"></i>
            </span>
            {!sidebarCollapsed ? 'Dashboard' : null}
          </NavLink>

          <NavLink
            to="/traces"
            className={({ isActive }) =>
              `mb-2 flex items-center rounded-md border py-2 text-sm font-medium transition-colors ${
                sidebarCollapsed ? 'justify-center px-2' : 'gap-2 px-4'
              } ${isActive ? 'border-emerald-500/30 bg-emerald-500/20 text-emerald-200' : 'border-transparent text-zinc-300 hover:border-zinc-800 hover:bg-zinc-900 hover:text-zinc-100'}`
            }
            title={sidebarCollapsed ? 'Traces' : undefined}
          >
            <span className="inline-flex h-5 w-5 items-center justify-center leading-none">
              <i className="fa-solid fa-magnifying-glass-chart text-sm leading-none"></i>
            </span>
            {!sidebarCollapsed ? 'Traces' : null}
          </NavLink>
          
          <NavLink
            to="/logs"
            className={({ isActive }) =>
              `mb-2 flex items-center rounded-md border py-2 text-sm font-medium transition-colors ${
                sidebarCollapsed ? 'justify-center px-2' : 'gap-2 px-4'
              } ${isActive ? 'border-violet-500/30 bg-violet-500/20 text-violet-300' : 'border-transparent text-zinc-300 hover:border-zinc-800 hover:bg-zinc-900 hover:text-zinc-100'}`
            }
            title={sidebarCollapsed ? 'Logs' : undefined}
          >
            <span className="inline-flex h-5 w-5 items-center justify-center leading-none">
              <i className="fa-solid fa-scroll text-sm leading-none"></i>
            </span>
            {!sidebarCollapsed ? 'Logs' : null}
          </NavLink>
          
        </nav>
        <div
          className={`h-screen overflow-y-scroll bg-zinc-950/70 px-8 py-12 transition-all duration-200 ${
            sidebarCollapsed ? 'ml-20' : 'ml-64'
          }`}
        >
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
