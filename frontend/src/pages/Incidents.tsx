import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { delete_incident, detect_incidents, get_incidents, get_pull_requests, merge_pull_request } from '../services/api'
import type { Incident } from '../types/Incident'
import type { PullRequest } from '../types/PullRequest'

const RESOLVED_INCIDENTS_LAST_MONTH = [
  { day: 'Jan 24', bySeverity: { low: 1, medium: 0, high: 0, critical: 0, blocker: 0 } },
  { day: 'Jan 26', bySeverity: { low: 0, medium: 0, high: 0, critical: 0, blocker: 0 } },
  { day: 'Jan 28', bySeverity: { low: 1, medium: 1, high: 0, critical: 0, blocker: 0 } },
  { day: 'Jan 30', bySeverity: { low: 0, medium: 1, high: 0, critical: 0, blocker: 0 } },
  { day: 'Feb 01', bySeverity: { low: 1, medium: 1, high: 1, critical: 0, blocker: 0 } },
  { day: 'Feb 03', bySeverity: { low: 0, medium: 1, high: 1, critical: 0, blocker: 0 } },
  { day: 'Feb 05', bySeverity: { low: 1, medium: 1, high: 1, critical: 1, blocker: 0 } },
  { day: 'Feb 07', bySeverity: { low: 1, medium: 0, high: 0, critical: 0, blocker: 0 } },
  { day: 'Feb 09', bySeverity: { low: 0, medium: 1, high: 1, critical: 0, blocker: 0 } },
  { day: 'Feb 11', bySeverity: { low: 1, medium: 2, high: 1, critical: 1, blocker: 0 } },
  { day: 'Feb 13', bySeverity: { low: 1, medium: 1, high: 1, critical: 0, blocker: 0 } },
  { day: 'Feb 15', bySeverity: { low: 0, medium: 1, high: 1, critical: 0, blocker: 0 } },
  { day: 'Feb 17', bySeverity: { low: 1, medium: 1, high: 1, critical: 1, blocker: 0 } },
  { day: 'Feb 19', bySeverity: { low: 0, medium: 1, high: 1, critical: 1, blocker: 0 } },
  { day: 'Feb 21', bySeverity: { low: 1, medium: 2, high: 1, critical: 1, blocker: 1 } },
]

const SEVERITY_ORDER: Incident['severity'][] = ['low', 'medium', 'high', 'critical', 'blocker']
const APPROX_IMPROVEMENT_PERCENT_BY_SEVERITY: Record<Incident['severity'], number> = {
  low: 6,
  medium: 12,
  high: 22,
  critical: 34,
  blocker: 48,
}

function getSeverityChartColorClass(severity: Incident['severity']) {
  switch (severity) {
    case 'low':
      return 'bg-emerald-400'
    case 'medium':
      return 'bg-yellow-400'
    case 'high':
      return 'bg-orange-400'
    case 'critical':
      return 'bg-rose-400'
    case 'blocker':
      return 'bg-red-500'
    default:
      return 'bg-zinc-400'
  }
}

function getSeverityBadgeClass(severity: Incident['severity']) {
  switch (severity) {
    case 'low':
      return 'border-emerald-500/30 bg-emerald-500/15 text-emerald-200'
    case 'medium':
      return 'border-yellow-500/30 bg-yellow-500/15 text-yellow-200'
    case 'high':
      return 'border-orange-500/30 bg-orange-500/15 text-orange-200'
    case 'critical':
      return 'border-rose-500/30 bg-rose-500/15 text-rose-200'
    case 'blocker':
      return 'border-red-500/40 bg-red-500/20 text-red-200'
    default:
      return 'border-zinc-700 bg-zinc-800 text-zinc-200'
  }
}

function formatSeverityLabel(severity: Incident['severity']) {
  return severity.charAt(0).toUpperCase() + severity.slice(1)
}

function formatImprovementPercent(percent: number) {
  return `~${percent.toFixed(0)}%`
}

export default function Reports() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [pullRequestsById, setPullRequestsById] = useState<Record<number, PullRequest>>({})
  const [loading, setLoading] = useState(true)
  const [detecting, setDetecting] = useState(false)
  const [autonomousAgentEnabled, setAutonomousAgentEnabled] = useState(true)
  const [confirmDetect, setConfirmDetect] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [mergingPrId, setMergingPrId] = useState<number | null>(null)
  const [rejectingIncidentId, setRejectingIncidentId] = useState<number | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<Incident | null>(null)
  const [confirmRejectTarget, setConfirmRejectTarget] = useState<Incident | null>(null)
  const [severityFilter, setSeverityFilter] = useState<'all' | Incident['severity']>('all')
  const [searchFilter, setSearchFilter] = useState('')
  const [fixOnly, setFixOnly] = useState(false)
  const [severityMenuOpen, setSeverityMenuOpen] = useState(false)

  async function detectIncidents() {
    setStatusMessage(null)
    setError(null)
    setDetecting(true)
    try {
      const detectResult = await detect_incidents()

      const [incidentResult, pullRequestResult] = await Promise.all([
        get_incidents(),
        get_pull_requests(),
      ])
      const pullRequestMap = Object.fromEntries(
        pullRequestResult.map((pullRequest: PullRequest) => [pullRequest.id, pullRequest]),
      ) as Record<number, PullRequest>

      setIncidents(incidentResult)
      setPullRequestsById(pullRequestMap)
      if ((detectResult?.count ?? 0) === 0) {
        setStatusMessage('No major inefficiencies were detected.')
      } else {
        setStatusMessage('Incident detection completed.')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to detect incidents')
    } finally {
      setDetecting(false)
    }
  }

  useEffect(() => {
    let cancelled = false

    async function loadIncidents() {
      try {
        const [incidentResult, pullRequestResult] = await Promise.all([
          get_incidents(),
          get_pull_requests(),
        ])
        const pullRequestMap = Object.fromEntries(
          pullRequestResult.map((pullRequest: PullRequest) => [pullRequest.id, pullRequest]),
        ) as Record<number, PullRequest>

        if (!cancelled) {
          setIncidents(incidentResult)
          setPullRequestsById(pullRequestMap)
          setError(null)
          setLoading(false)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load incidents')
          setLoading(false)
        }
      }
    }

    loadIncidents()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!statusMessage && !error) {
      return
    }

    const timeout = window.setTimeout(() => {
      setStatusMessage(null)
      setError(null)
    }, 7500)

    return () => window.clearTimeout(timeout)
  }, [statusMessage, error])

  const maxResolvedCount = Math.max(
    ...RESOLVED_INCIDENTS_LAST_MONTH.map((d) =>
      SEVERITY_ORDER.reduce((sum, severity) => sum + (d.bySeverity[severity] ?? 0), 0),
    ),
    1,
  )
  const totalResolved = RESOLVED_INCIDENTS_LAST_MONTH.reduce(
    (sum, d) => sum + SEVERITY_ORDER.reduce((inner, severity) => inner + (d.bySeverity[severity] ?? 0), 0),
    0,
  )
  const weightedImprovementPercentSum = RESOLVED_INCIDENTS_LAST_MONTH.reduce(
    (sum, d) =>
      sum +
      SEVERITY_ORDER.reduce(
        (inner, severity) =>
          inner + (d.bySeverity[severity] ?? 0) * APPROX_IMPROVEMENT_PERCENT_BY_SEVERITY[severity],
        0,
      ),
    0,
  )
  const approxImprovementPercent = totalResolved > 0 ? weightedImprovementPercentSum / totalResolved : 0
  const normalizedSearch = searchFilter.trim().toLowerCase()
  const filteredIncidents = incidents.filter((incident) => {
    if (severityFilter !== 'all' && incident.severity !== severityFilter) {
      return false
    }
    if (fixOnly && !incident.pullRequest) {
      return false
    }
    if (!normalizedSearch) {
      return true
    }

    const haystack = [
      incident.title,
      incident.url,
      incident.problemDescription,
      incident.solutionDescription,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return haystack.includes(normalizedSearch)
  })

  return (
    <>
      <section className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-8 shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400/80">Monitoring</p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <h1 className="page-title text-4xl font-extrabold tracking-tight text-zinc-50">Dashboard</h1>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setAutonomousAgentEnabled((prev) => !prev)}
              className={`group flex cursor-pointer items-center gap-3 rounded border px-3 py-2 text-sm transition ${
                autonomousAgentEnabled
                  ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/15'
                  : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
              }`}
              aria-pressed={autonomousAgentEnabled}
              title="Toggle autonomous AI agent mode"
            >
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-robot text-xs"></i>
                <span className="text-xs font-semibold uppercase tracking-[0.12em]">Autonomous AI Agent</span>
              </div>
              <span
                className={`relative inline-flex h-6 w-11 items-center rounded-full border transition ${
                  autonomousAgentEnabled
                    ? 'border-emerald-400/30 bg-emerald-500/20'
                    : 'border-zinc-600 bg-zinc-800'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full transition ${
                    autonomousAgentEnabled
                      ? 'translate-x-5 bg-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.35)]'
                      : 'translate-x-1 bg-zinc-400'
                  }`}
                />
              </span>
              <span
                className={`min-w-8 text-right text-xs font-semibold uppercase tracking-[0.12em] ${
                  autonomousAgentEnabled ? 'text-emerald-200' : 'text-zinc-400'
                }`}
              >
                {autonomousAgentEnabled ? 'On' : 'Off'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setConfirmDetect(true)}
              disabled={detecting}
              className="flex cursor-pointer flex-row items-center gap-2 rounded border border-blue-500/40 bg-blue-500/20 px-3 py-2 text-sm font-medium text-blue-200 hover:bg-blue-500/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <i className="fa-solid fa-bolt"></i>
              {detecting ? 'Detecting...' : 'Detect Incidents'}
            </button>
          </div>
        </div>
        <div className="mt-4 h-px w-28 bg-linear-to-r from-blue-400/80 to-transparent" />

        <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-300/80">
                Resolved Incidents
              </p>
              <h2 className="mt-1 text-lg font-semibold text-zinc-100">Last 30 days</h2>
            </div>
            <div className="flex flex-wrap items-stretch gap-2">
              <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-right">
                <div className="text-[11px] uppercase tracking-[0.12em] text-blue-200/80">Total Resolved</div>
                <div className="text-xl font-semibold text-blue-100">{totalResolved}</div>
              </div>
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-right">
                <div className="text-[11px] uppercase tracking-[0.12em] text-emerald-200/80">
                  Performance Improvement
                </div>
                <div className="text-xl font-semibold text-emerald-100">
                  {formatImprovementPercent(approxImprovementPercent)}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-15 items-end gap-2">
            {RESOLVED_INCIDENTS_LAST_MONTH.map((point) => {
              const totalForDay = SEVERITY_ORDER.reduce(
                (sum, severity) => sum + (point.bySeverity[severity] ?? 0),
                0,
              )
              const heightPct = (totalForDay / maxResolvedCount) * 100
              return (
                <div key={point.day} className="group/day relative flex min-w-0 flex-col items-center gap-2">
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-3 hidden w-52 -translate-x-1/2 rounded-lg border border-zinc-700 bg-zinc-950/95 p-3 text-left shadow-[0_16px_40px_rgba(0,0,0,0.45)] group-hover/day:block">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-200">
                        {point.day}
                      </span>
                      <span className="text-xs text-zinc-400">
                        {totalForDay} total
                      </span>
                    </div>
                    <div className="mt-2 h-px bg-zinc-800" />
                    <ul className="mt-2 space-y-1.5">
                      {SEVERITY_ORDER.map((severity) => (
                        <li key={`${point.day}-tooltip-${severity}`} className="flex items-center justify-between gap-2 text-xs">
                          <span className="inline-flex items-center gap-2 text-zinc-300">
                            <span className={`h-2.5 w-2.5 rounded-full ${getSeverityChartColorClass(severity)}`} />
                            {formatSeverityLabel(severity)}
                          </span>
                          <span className="font-medium text-zinc-100">
                            {point.bySeverity[severity] ?? 0}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <span className="text-[11px] text-zinc-500">{totalForDay}</span>
                  <div className="flex h-32 w-full items-end rounded-md border border-zinc-800 bg-zinc-900/70 p-1">
                    <div
                      className="flex w-full flex-col justify-end overflow-hidden rounded-sm shadow-[0_0_14px_rgba(59,130,246,0.15)]"
                      style={{ height: `${Math.max(heightPct, totalForDay > 0 ? 8 : 0)}%` }}
                    >
                      {[...SEVERITY_ORDER].reverse().map((severity) => {
                        const value = point.bySeverity[severity] ?? 0
                        if (value <= 0 || totalForDay <= 0) return null
                        return (
                          <div
                            key={`${point.day}-${severity}`}
                            className={`w-full ${getSeverityChartColorClass(severity)}`}
                            style={{ height: `${(value / totalForDay) * 100}%` }}
                            title={`${point.day}: ${formatSeverityLabel(severity)} ${value}`}
                          />
                        )
                      })}
                    </div>
                  </div>
                  <span className="truncate text-[10px] uppercase tracking-[0.08em] text-zinc-500">
                    {point.day}
                  </span>
                </div>
              )
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {SEVERITY_ORDER.map((severity) => (
              <span
                key={severity}
                className="inline-flex items-center gap-2 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-300"
              >
                <span className={`h-2.5 w-2.5 rounded-full ${getSeverityChartColorClass(severity)}`} />
                {formatSeverityLabel(severity)}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-300/80">Filters</p>
              <p className="text-sm text-zinc-400">Refine the incident list below.</p>
            </div>
            <span className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-300">
              {filteredIncidents.length} of {incidents.length} incidents
            </span>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_220px_auto]">
            <label className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 py-2">
              <i className="fa-solid fa-magnifying-glass text-xs text-zinc-500"></i>
              <input
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search title, URL, or descriptions..."
                className="w-full bg-transparent text-sm text-zinc-200 outline-none placeholder:text-zinc-500"
              />
            </label>

            <div className="relative">
              <button
                type="button"
                onClick={() => setSeverityMenuOpen((prev) => !prev)}
                className="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800/80"
                aria-haspopup="listbox"
                aria-expanded={severityMenuOpen}
              >
                <i className="fa-solid fa-filter text-xs text-zinc-500"></i>
                <span className="flex-1 text-left">
                  {severityFilter === 'all' ? 'All severities' : formatSeverityLabel(severityFilter)}
                </span>
                <i
                  className={`fa-solid fa-chevron-down text-xs text-zinc-500 transition-transform ${
                    severityMenuOpen ? 'rotate-180' : ''
                  }`}
                ></i>
              </button>

              {severityMenuOpen ? (
                <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950 shadow-[0_18px_40px_rgba(0,0,0,0.5)]">
                  <div className="border-b border-zinc-800 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                    Severity
                  </div>
                  <ul className="p-1" role="listbox">
                    {(['all', ...SEVERITY_ORDER] as const).map((value) => {
                      const isActive = severityFilter === value
                      const label = value === 'all' ? 'All severities' : formatSeverityLabel(value)
                      return (
                        <li key={value}>
                          <button
                            type="button"
                            onClick={() => {
                              setSeverityFilter(value)
                              setSeverityMenuOpen(false)
                            }}
                            className={`flex w-full cursor-pointer items-center justify-between rounded-md px-2.5 py-2 text-sm transition ${
                              isActive
                                ? 'bg-blue-500/15 text-blue-200'
                                : 'text-zinc-200 hover:bg-zinc-900'
                            }`}
                            role="option"
                            aria-selected={isActive}
                          >
                            <span className="flex items-center gap-2">
                              {value !== 'all' ? (
                                <span
                                  className={`h-2.5 w-2.5 rounded-full ${
                                    value === 'low'
                                      ? 'bg-emerald-400'
                                      : value === 'medium'
                                        ? 'bg-yellow-400'
                                        : value === 'high'
                                          ? 'bg-orange-400'
                                          : value === 'critical'
                                            ? 'bg-rose-400'
                                            : 'bg-red-500'
                                  }`}
                                />
                              ) : (
                                <span className="h-2.5 w-2.5 rounded-full bg-zinc-500" />
                              )}
                              {label}
                            </span>
                            {isActive ? <i className="fa-solid fa-check text-xs text-blue-300"></i> : null}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => setFixOnly((prev) => !prev)}
              className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                fixOnly
                  ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-200'
                  : 'border-zinc-800 bg-zinc-900/70 text-zinc-300 hover:bg-zinc-800'
              }`}
              aria-pressed={fixOnly}
            >
              <i className="fa-solid fa-wrench text-xs"></i>
              Fix available only
            </button>
          </div>
        </div>

      {loading ? (
        <ul className="mt-5 space-y-3">
          {[0, 1, 2].map((idx) => (
            <li key={idx} className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
              <div className="h-4 w-56 animate-pulse rounded bg-zinc-800" />
              <div className="mt-3 h-3 w-40 animate-pulse rounded bg-zinc-800/80" />
            </li>
          ))}
        </ul>
      ) : null}

        {!loading ? (
          <ul className="mt-5 space-y-3">
            {filteredIncidents.length === 0 ? (
              <li className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-zinc-400">
                {incidents.length === 0 ? 'No incidents found.' : 'No incidents match the current filters.'}
              </li>
            ) : (
              [...filteredIncidents]
                .sort((a, b) => b.id - a.id)
                .map((incident) => (
                  <li key={incident.id} className="rounded-lg border border-zinc-800 bg-zinc-950/70">
                    <details className="group">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded text-xs text-zinc-400 transition-transform group-open:rotate-90">
                            <i className="fa-solid fa-chevron-right"></i>
                          </span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`rounded border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] ${getSeverityBadgeClass(
                                  incident.severity ?? 'medium',
                                )}`}
                              >
                                {formatSeverityLabel(incident.severity ?? 'medium')}
                              </span>
                              <h2 className="truncate text-lg font-semibold text-zinc-100">{incident.title}</h2>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                              <span className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-300">
                                {incident.timeImpact.toFixed(2)}s
                              </span>
                              <span className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-300">
                                {incident.impactCount} {incident.impactCount === 1 ? 'instance' : 'instances'}
                              </span>
                              <span className="rounded border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-emerald-200">
                                Fix available
                              </span>
                            </div>
                          </div>
                        </div>
                        <span className="max-w-[16rem] shrink-0 truncate rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-300">
                          {incident.url || 'Unknown URL'}
                        </span>
                      </summary>

                      <div className="border-t border-zinc-800 px-4 py-3">
                        <p className="text-sm text-zinc-300">
                          <span className="font-semibold text-zinc-200">Problem:</span> {incident.problemDescription}
                        </p>
                        <p className="mt-2 text-sm text-zinc-300">
                          <span className="font-semibold text-zinc-200">Solution:</span> {incident.solutionDescription}
                        </p>
                        <div className="mt-3 rounded-md border border-zinc-800 bg-zinc-900/60 p-3 text-xs text-zinc-300">
                          <div className="mb-2 font-semibold uppercase tracking-wide text-zinc-400">Pull Request</div>
                          {incident.pullRequest && pullRequestsById[incident.pullRequest] ? (
                            <>
                              <div className="font-medium text-zinc-100">{pullRequestsById[incident.pullRequest].title}</div>
                              <div className="mt-2 text-zinc-400">
                                <span className="p-1 rounded-md border border-zinc-800/80 bg-zinc-950/70">
                                  {pullRequestsById[incident.pullRequest].repo_owner}/{pullRequestsById[incident.pullRequest].repo_name}
                                  {' | '}
                                  {pullRequestsById[incident.pullRequest].head_branch}
                                </span>
                                <i className="fa-solid fa-arrow-right-long mx-2"></i>
                                <span className="p-1 rounded-md border border-zinc-800/80 bg-zinc-950/70">{pullRequestsById[incident.pullRequest].base_branch}</span>
                              </div>
                              {pullRequestsById[incident.pullRequest].body ? (
                                <details className="group/prdesc mt-3 rounded-md border border-zinc-800/80 bg-zinc-950/70">
                                  <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2">
                                    <div className="flex items-center gap-2">
                                      <span className="inline-flex h-4 w-4 items-center justify-center text-[10px] text-zinc-400 transition-transform group-open/prdesc:rotate-90">
                                        <i className="fa-solid fa-chevron-right"></i>
                                      </span>
                                      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
                                        Pull Request Description
                                      </span>
                                    </div>
                                    <span className="text-[11px] text-zinc-500">Expand</span>
                                  </summary>
                                  <div className="border-t border-zinc-800/80 p-3">
                                  <div className="prose prose-invert max-w-none text-sm leading-7 prose-headings:text-zinc-100 prose-p:my-3 prose-p:text-zinc-300 prose-p:leading-7 prose-strong:text-zinc-100 prose-code:text-blue-200 prose-pre:border prose-pre:border-zinc-800 prose-pre:bg-zinc-900 prose-pre:text-sm prose-li:my-1 prose-li:text-zinc-300 prose-li:leading-7 prose-a:text-blue-300 hover:prose-a:text-blue-200">
                                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {pullRequestsById[incident.pullRequest].body}
                                      </ReactMarkdown>
                                    </div>
                                  </div>
                                </details>
                              ) : null}
                            </>
                          ) : (
                            <div className="text-zinc-400">No linked PR details found.</div>
                          )}
                        </div>

                        <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-400">
                          {incident.pullRequest ? (
                            <>
                              <button
                                type="button"
                                disabled={mergingPrId === incident.pullRequest}
                                onClick={() => setConfirmTarget(incident)}
                                className="cursor-pointer flex flex-row items-center gap-2 rounded border border-blue-500/40 bg-blue-500/20 px-3 py-2 text-sm font-medium text-blue-200 hover:bg-blue-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <i className="fa-solid fa-code-pull-request"></i>
                                {mergingPrId === incident.pullRequest ? 'Creating...' : 'Create PR'}
                              </button>
                              <button
                                type="button"
                                disabled={rejectingIncidentId === incident.id}
                                onClick={() => setConfirmRejectTarget(incident)}
                                className="cursor-pointer flex flex-row items-center gap-2 rounded border border-rose-500/35 bg-rose-500/15 px-3 py-2 text-sm font-medium text-rose-200 hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <i className="fa-solid fa-xmark"></i>
                                {rejectingIncidentId === incident.id ? 'Rejecting...' : 'Reject Fix'}
                              </button>
                            </>
                          ) : (
                            <span className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-400">
                              No linked PR
                            </span>
                          )}
                        </div>
                      </div>
                    </details>
                  </li>
                ))
            )}
          </ul>
        ) : null}
      </section>
      {confirmDetect ? (
        <div onClick={() => setConfirmDetect(false)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.55)]">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-400/80">Confirm Action</p>
            <h2 className="mt-2 text-xl font-semibold text-zinc-100">Detect Incidents?</h2>
            <p className="mt-3 text-sm text-zinc-300">
              This will run incident detection on the backend using the latest traces and refresh the incidents list.
            </p>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDetect(false)}
                className="cursor-pointer rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={detecting}
                onClick={async () => {
                  setConfirmDetect(false)
                  await detectIncidents()
                }}
                className="flex cursor-pointer flex-row items-center gap-2 rounded border border-blue-500/40 bg-blue-500/20 px-3 py-1.5 text-sm font-medium text-blue-200 hover:bg-blue-500/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <i className="fa-solid fa-bolt"></i>
                {detecting ? 'Detecting...' : 'Proceed'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {detecting ? (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/75 px-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/95 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.6)]">
            <div className="flex items-center gap-4">
              <div className="relative flex h-12 w-12 items-center justify-center">
                <div className="absolute inset-0 rounded-full border border-blue-400/20 animate-ping" />
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-blue-400" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-400/80">
                  Detection Running
                </p>
                <h2 className="mt-1 text-lg font-semibold text-zinc-100">Detecting incidents...</h2>
              </div>
            </div>

            <p className="mt-4 text-sm text-zinc-300">
              Analyzing traces and generating suggested pull requests. This may take a moment.
            </p>

            <div className="mt-5 flex items-center gap-2 text-blue-300">
              <span className="h-2 w-2 animate-bounce rounded-full bg-blue-300" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-blue-300 [animation-delay:120ms]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-blue-300 [animation-delay:240ms]" />
              <span className="ml-2 text-xs uppercase tracking-[0.14em] text-zinc-400">
                Refreshing incidents when complete
              </span>
            </div>
          </div>
        </div>
      ) : null}
      {confirmTarget && confirmTarget.pullRequest ? (
        <div onClick={() => setConfirmTarget(null)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.55)]">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-400/80">Confirm Action</p>
            <h2 className="mt-2 text-xl font-semibold text-zinc-100">Merge Pull Request?</h2>
            <p className="mt-3 text-sm text-zinc-300">
              This will merge the pull request linked to incident <span className="font-semibold text-zinc-100">#{confirmTarget.id}</span>.
            </p>
            <p className="mt-2 truncate text-sm text-zinc-400">{confirmTarget.title}</p>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmTarget(null)}
                className="cursor-pointer rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={mergingPrId === confirmTarget.pullRequest}
                onClick={async () => {
                  setStatusMessage(null)
                  setError(null)
                  setMergingPrId(confirmTarget.pullRequest as number)
                  try {
                    await merge_pull_request(confirmTarget.pullRequest as number)
                    setStatusMessage(`Merged pull request #${confirmTarget.pullRequest} for incident #${confirmTarget.id}.`)
                    setConfirmTarget(null)
                  } catch (e) {
                    setError(e instanceof Error ? e.message : 'Failed to merge pull request')
                  } finally {
                    setMergingPrId(null)
                  }
                }}
                className="flex flex-row items-center cursor-pointer rounded border border-blue-500/40 bg-blue-500/20 px-3 py-1.5 text-sm font-medium text-blue-200 hover:bg-blue-500/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <i className="fa-solid fa-code-pull-request"></i>
                {mergingPrId === confirmTarget.pullRequest ? 'Creating...' : 'Create PR'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {confirmRejectTarget ? (
        <div onClick={() => setConfirmRejectTarget(null)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.55)]">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-400/80">Confirm Action</p>
            <h2 className="mt-2 text-xl font-semibold text-zinc-100">Reject Suggested Fix?</h2>
            <p className="mt-3 text-sm text-zinc-300">
              This will remove incident <span className="font-semibold text-zinc-100">#{confirmRejectTarget.id}</span> from the dashboard.
            </p>
            <p className="mt-2 truncate text-sm text-zinc-400">{confirmRejectTarget.title}</p>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmRejectTarget(null)}
                className="cursor-pointer rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={rejectingIncidentId === confirmRejectTarget.id}
                onClick={async () => {
                  setStatusMessage(null)
                  setError(null)
                  setRejectingIncidentId(confirmRejectTarget.id)
                  try {
                    await delete_incident(confirmRejectTarget.id)
                    setIncidents((prev) => prev.filter((incident) => incident.id !== confirmRejectTarget.id))
                    setStatusMessage(`Rejected suggested fix for incident #${confirmRejectTarget.id}.`)
                    setConfirmRejectTarget(null)
                  } catch (e) {
                    setError(e instanceof Error ? e.message : 'Failed to reject suggested fix')
                  } finally {
                    setRejectingIncidentId(null)
                  }
                }}
                className="flex flex-row items-center cursor-pointer rounded border border-rose-500/35 bg-rose-500/15 px-3 py-1.5 text-sm font-medium text-rose-200 hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <i className="fa-solid fa-trash"></i>
                {rejectingIncidentId === confirmRejectTarget.id ? 'Rejecting...' : 'Reject Fix'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {statusMessage || error ? (
        <div className="pointer-events-none fixed right-4 bottom-4 z-70 w-full max-w-md">
          <div
            className={`pointer-events-auto rounded-xl border p-4 shadow-[0_18px_50px_rgba(0,0,0,0.45)] backdrop-blur-sm transition-all ${
              error
                ? 'border-rose-500/30 bg-rose-950/70 text-rose-100'
                : 'border-emerald-500/30 bg-emerald-950/60 text-emerald-100'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                  error
                    ? 'border-rose-400/30 bg-rose-500/15 text-rose-300'
                    : 'border-emerald-400/30 bg-emerald-500/15 text-emerald-300'
                }`}
              >
                <i className={`fa-solid ${error ? 'fa-triangle-exclamation' : 'fa-circle-check'}`}></i>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] opacity-80">
                  {error ? 'Detection Error' : 'Incidents Updated'}
                </p>
                <p className="mt-1 text-sm leading-6">{error ?? statusMessage}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setStatusMessage(null)
                  setError(null)
                }}
                className="cursor-pointer rounded p-1 text-zinc-300/80 hover:bg-black/20 hover:text-white"
                aria-label="Dismiss notification"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-black/20">
              <div
                className={`h-full w-full animate-pulse ${
                  error ? 'bg-rose-400/70' : 'bg-emerald-400/70'
                }`}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
