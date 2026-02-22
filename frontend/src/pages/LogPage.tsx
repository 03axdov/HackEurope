import { useEffect, useMemo, useState } from 'react'
import { get_logs } from '../services/api'
import type { LogEntry, LogLevel } from '../types/Log'

const LEVEL_LABELS: Record<LogLevel | 'all', string> = {
  all: 'All',
  info: 'Info',
  warning: 'Warnings',
  error: 'Errors',
}

const LEVEL_STYLES: Record<LogLevel, string> = {
  info: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
  warning: 'border-amber-500/30 bg-amber-500/15 text-amber-200',
  error: 'border-rose-500/30 bg-rose-500/15 text-rose-200',
}

function formatTimestamp(value: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) {
    return value
  }
  return d.toLocaleString()
}

function groupByRun(logs: LogEntry[]) {
  const groups = new Map<string, LogEntry[]>()
  for (const log of logs) {
    const key = log.run_id || 'unknown'
    const curr = groups.get(key)
    if (curr) {
      curr.push(log)
    } else {
      groups.set(key, [log])
    }
  }

  return [...groups.entries()]
    .map(([runId, entries]) => ({
      runId,
      entries: [...entries].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    }))
    .sort((a, b) => {
      const aLast = a.entries[a.entries.length - 1]
      const bLast = b.entries[b.entries.length - 1]
      return new Date(bLast?.created_at ?? 0).getTime() - new Date(aLast?.created_at ?? 0).getTime()
    })
}

export default function LogPage() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedLevel, setSelectedLevel] = useState<LogLevel | 'all'>('all')

  useEffect(() => {
    let cancelled = false

    async function loadLogs() {
      try {
        const result = await get_logs()
        if (!cancelled) {
          setLogs(result)
          setError(null)
          setLoading(false)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load logs')
          setLoading(false)
        }
      }
    }

    loadLogs()
    return () => {
      cancelled = true
    }
  }, [])

  const filteredLogs = useMemo(
    () => (selectedLevel === 'all' ? logs : logs.filter((log) => log.level === selectedLevel)),
    [logs, selectedLevel],
  )

  const groupedRuns = useMemo(() => groupByRun(filteredLogs), [filteredLogs])

  const runSummary = useMemo(
    () =>
      groupByRun(logs)
        .map((group) => {
          const infoCount = group.entries.filter((e) => e.level === 'info').length
          const warningCount = group.entries.filter((e) => e.level === 'warning').length
          const errorCount = group.entries.filter((e) => e.level === 'error').length
          const total = group.entries.length

          return {
            runId: group.runId,
            total,
            infoCount,
            warningCount,
            errorCount,
            startedAt: group.entries[0]?.created_at ?? '',
            endedAt: group.entries[group.entries.length - 1]?.created_at ?? '',
          }
        })
        .slice(0, 10),
    [logs],
  )

  const counts = useMemo(
    () => ({
      all: logs.length,
      info: logs.filter((l) => l.level === 'info').length,
      warning: logs.filter((l) => l.level === 'warning').length,
      error: logs.filter((l) => l.level === 'error').length,
    }),
    [logs],
  )

  const maxRunLogCount = useMemo(
    () => Math.max(...runSummary.map((run) => run.total), 1),
    [runSummary],
  )

  return (
    <section className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-8 shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-400/80">Activity</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title text-4xl tracking-tight text-zinc-50">Logs</h1>
        <div className="flex flex-wrap gap-2">
          {(['all', 'info', 'warning', 'error'] as const).map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setSelectedLevel(level)}
              className={`cursor-pointer rounded border px-3 py-1.5 text-xs font-medium transition ${
                selectedLevel === level
                  ? 'border-violet-500/40 bg-violet-500/20 text-violet-200'
                  : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              {LEVEL_LABELS[level]} ({counts[level]})
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4 h-px w-28 bg-linear-to-r from-violet-400/80 to-transparent" />

      {!loading ? (
        <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-300/80">
                Run Overview
              </p>
              <h2 className="text-lg font-semibold text-zinc-100">Recent detection runs</h2>
            </div>
            <span className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-400">
              {runSummary.length} runs
            </span>
          </div>

          {runSummary.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-400">No run data available yet.</p>
          ) : (
            <>
              <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
                {runSummary.map((run) => {
                  const barHeightPct = (run.total / maxRunLogCount) * 100
                  return (
                    <div
                      key={run.runId}
                      className="group rounded-lg border border-zinc-800 bg-zinc-900/60 p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="rounded border border-violet-500/25 bg-violet-500/10 px-2 py-0.5 text-[11px] text-violet-200">
                              {run.runId}
                            </span>
                            <span className="text-xs text-zinc-500">{formatTimestamp(run.endedAt)}</span>
                          </div>
                          <div className="mt-2 text-sm text-zinc-300">
                            {run.total} logs, {run.warningCount} warnings, {run.errorCount} errors
                          </div>
                        </div>
                        <div className="flex h-16 w-12 items-end rounded-md border border-zinc-800 bg-zinc-950/80 p-1">
                          <div
                            className="w-full rounded-sm bg-linear-to-t from-violet-700 via-violet-500 to-fuchsia-300 shadow-[0_0_12px_rgba(168,85,247,0.25)]"
                            style={{ height: `${Math.max(barHeightPct, run.total > 0 ? 8 : 0)}%` }}
                          />
                        </div>
                      </div>

                      <div className="mt-3">
                        <div className="mb-1 flex items-center justify-between text-[11px] text-zinc-500">
                          <span>Severity distribution</span>
                          <span>{run.total} total</span>
                        </div>
                        <div className="flex h-2 overflow-hidden rounded-full border border-zinc-800 bg-zinc-950">
                          {run.infoCount > 0 ? (
                            <div
                              className="bg-sky-400"
                              style={{ width: `${(run.infoCount / run.total) * 100}%` }}
                              title={`Info: ${run.infoCount}`}
                            />
                          ) : null}
                          {run.warningCount > 0 ? (
                            <div
                              className="bg-amber-400"
                              style={{ width: `${(run.warningCount / run.total) * 100}%` }}
                              title={`Warnings: ${run.warningCount}`}
                            />
                          ) : null}
                          {run.errorCount > 0 ? (
                            <div
                              className="bg-rose-400"
                              style={{ width: `${(run.errorCount / run.total) * 100}%` }}
                              title={`Errors: ${run.errorCount}`}
                            />
                          ) : null}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                          <span className="inline-flex items-center gap-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-zinc-300">
                            <span className="h-2 w-2 rounded-full bg-sky-400" />
                            Info {run.infoCount}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-zinc-300">
                            <span className="h-2 w-2 rounded-full bg-amber-400" />
                            Warning {run.warningCount}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-zinc-300">
                            <span className="h-2 w-2 rounded-full bg-rose-400" />
                            Error {run.errorCount}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      ) : null}

      {loading ? (
        <ul className="mt-5 space-y-3">
          {[0, 1, 2].map((idx) => (
            <li key={idx} className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
              <div className="h-4 w-48 animate-pulse rounded bg-zinc-800" />
              <div className="mt-3 h-3 w-full animate-pulse rounded bg-zinc-800/70" />
              <div className="mt-2 h-3 w-3/4 animate-pulse rounded bg-zinc-800/60" />
            </li>
          ))}
        </ul>
      ) : null}

      {error ? (
        <div className="mt-5 rounded-lg border border-rose-500/20 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {!loading ? (
        <div className="mt-5 space-y-4">
          {groupedRuns.length === 0 ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-zinc-400">
              No logs found.
            </div>
          ) : (
            groupedRuns.map((group) => {
              const entries = group.entries
              const first = entries[0]
              const last = entries[entries.length - 1]
              const errorCount = entries.filter((e) => e.level === 'error').length
              const warningCount = entries.filter((e) => e.level === 'warning').length

              return (
                <details key={group.runId} className="group rounded-xl border border-zinc-800 bg-zinc-950/70" open>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="inline-flex h-5 w-5 items-center justify-center text-xs text-zinc-400 transition-transform group-open:rotate-90">
                        <i className="fa-solid fa-chevron-right"></i>
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded border border-violet-500/30 bg-violet-500/15 px-2 py-0.5 text-xs text-violet-200">
                            Run {group.runId}
                          </span>
                          <span className="text-sm text-zinc-300">
                            {entries.length} log{entries.length === 1 ? '' : 's'}
                          </span>
                          {warningCount > 0 ? (
                            <span className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-200">
                              {warningCount} warning{warningCount === 1 ? '' : 's'}
                            </span>
                          ) : null}
                          {errorCount > 0 ? (
                            <span className="rounded border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-xs text-rose-200">
                              {errorCount} error{errorCount === 1 ? '' : 's'}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-zinc-500">
                          {formatTimestamp(first?.created_at ?? '')} - {formatTimestamp(last?.created_at ?? '')}
                        </p>
                      </div>
                    </div>
                  </summary>

                  <div className="border-t border-zinc-800 p-3">
                    <ul className="space-y-2">
                      {entries.map((log) => (
                        <li key={log.id} className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`rounded border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] ${LEVEL_STYLES[log.level]}`}>
                                  {log.level}
                                </span>
                                <span className="rounded border border-zinc-700 bg-zinc-800/80 px-2 py-0.5 text-[11px] text-zinc-300">
                                  {log.step}
                                </span>
                                {log.incident ? (
                                  <span className="text-xs text-zinc-400">Incident #{log.incident}</span>
                                ) : null}
                                {log.pull_request ? (
                                  <span className="text-xs text-zinc-400">PR #{log.pull_request}</span>
                                ) : null}
                              </div>
                              <p className="mt-2 text-sm leading-6 text-zinc-200">{log.message}</p>
                            </div>
                            <span className="shrink-0 text-xs text-zinc-500">{formatTimestamp(log.created_at)}</span>
                          </div>

                          {log.context && Object.keys(log.context).length > 0 ? (
                            <details className="mt-3">
                              <summary className="cursor-pointer list-none text-xs font-medium uppercase tracking-[0.12em] text-zinc-400 hover:text-zinc-300">
                                Context
                              </summary>
                              <pre className="mt-2 overflow-x-auto rounded-md border border-zinc-800 bg-zinc-950/80 p-3 text-xs leading-5 text-zinc-300">
{JSON.stringify(log.context, null, 2)}
                              </pre>
                            </details>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                </details>
              )
            })
          )}
        </div>
      ) : null}
    </section>
  )
}
