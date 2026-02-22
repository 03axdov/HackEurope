import { useEffect, useState, type ReactNode } from 'react'
import { get_services, get_traces } from '../services/api'
import type { Span, Trace } from '../types/Trace'

type ServicesResponse = {
  data: string[]
}

function formatDuration(durationMicros: number): string {
  if (durationMicros < 1000) return `${durationMicros} us`
  if (durationMicros < 1_000_000) return `${(durationMicros / 1000).toFixed(2)} ms`
  return `${(durationMicros / 1_000_000).toFixed(2)} s`
}

function formatStartTime(startTimeEpoch: number): string {
  let tsMs = startTimeEpoch

  // Jaeger timestamps may come as ns/us/ms. Normalize to milliseconds.
  if (startTimeEpoch > 1e17) {
    tsMs = Math.floor(startTimeEpoch / 1_000_000) // ns -> ms
  } else if (startTimeEpoch > 1e14) {
    tsMs = Math.floor(startTimeEpoch / 1_000) // us -> ms
  }

  return new Date(tsMs).toISOString().replace('T', ' ').replace('Z', ' UTC')
}

function getAbsoluteDurationColorClass(durationMicros: number): string {
  if (durationMicros < 1_000) return 'text-emerald-300' // <1ms
  if (durationMicros < 10_000) return 'text-green-300' // <10ms
  if (durationMicros < 100_000) return 'text-lime-300' // <100ms
  if (durationMicros < 500_000) return 'text-yellow-300' // <500ms
  if (durationMicros < 1_000_000) return 'text-amber-300' // <1s
  if (durationMicros < 3_000_000) return 'text-orange-300' // <3s
  if (durationMicros < 10_000_000) return 'text-red-300' // <10s
  if (durationMicros < 30_000_000) return 'text-red-400' // <30s
  return 'text-red-500' // >=30s
}

function getOperationTextColorClass(depth: number): string {
  if (depth <= 0) return 'text-emerald-200'
  if (depth === 1) return 'text-emerald-300'
  if (depth === 2) return 'text-emerald-400'
  if (depth === 3) return 'text-emerald-500'
  return 'text-emerald-600'
}

function sortSpans(a: Span, b: Span): number {
  const byStartTime = a.startTime - b.startTime
  if (byStartTime !== 0) return byStartTime
  return b.duration - a.duration
}

function getParentSpanId(span: Span): string | null {
  const parentRef = span.references.find((reference) => reference.refType === 'CHILD_OF')
  return parentRef?.spanID ?? null
}

function buildSpanHierarchy(spans: Span[]): { roots: Span[]; childrenByParent: Map<string, Span[]> } {
  const byId = new Map(spans.map((span) => [span.spanID, span] as const))
  const childrenByParent = new Map<string, Span[]>()
  const roots: Span[] = []

  for (const span of spans) {
    const parentSpanId = span.parentSpanID ?? getParentSpanId(span)
    if (parentSpanId && byId.has(parentSpanId)) {
      const children = childrenByParent.get(parentSpanId) ?? []
      children.push(span)
      childrenByParent.set(parentSpanId, children)
    } else {
      roots.push(span)
    }
  }

  roots.sort(sortSpans)
  for (const children of childrenByParent.values()) {
    children.sort(sortSpans)
  }

  return { roots, childrenByParent }
}

function getTraceRootStartTime(trace: Trace): number {
  const spanIds = new Set(trace.spans.map((span) => span.spanID))
  const roots = trace.spans.filter((span) => {
    const parentSpanId = span.parentSpanID ?? getParentSpanId(span)
    return !parentSpanId || !spanIds.has(parentSpanId)
  })

  if (roots.length === 0) {
    return Number.MAX_SAFE_INTEGER
  }

  roots.sort(sortSpans)
  return roots[0].startTime
}

export default function Dashboard() {
  const [services, setServices] = useState<Record<string, Trace[]>>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadServicesAndTraces() {
      try {
        const result = (await get_services()) as ServicesResponse
        const names = Array.isArray(result?.data) ? result.data : []

        const entries = await Promise.all(
          names.map(async (name) => {
            const traces = await get_traces(name, 20)
            return [name, traces] as const
          }),
        )

        const servicesMap: Record<string, Trace[]> = Object.fromEntries(entries)
        if (!cancelled) {
          setServices(servicesMap)
          setError(null)
          setLoading(false)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load services and traces')
          setLoading(false)
        }
      }
    }

    loadServicesAndTraces()
    return () => {
      cancelled = true
    }
  }, [])

  const taskDurationStats = Object.values(services)
    .flatMap((traces) => traces)
    .flatMap((trace) => trace.spans)
    .reduce<Record<string, { total: number; count: number; max: number }>>((acc, span) => {
      const key = span.operationName || 'Unknown operation'
      const current = acc[key] ?? { total: 0, count: 0, max: 0 }
      current.total += span.duration
      current.count += 1
      current.max = Math.max(current.max, span.duration)
      acc[key] = current
      return acc
    }, {})

  const topTaskDurations = Object.entries(taskDurationStats)
    .map(([operationName, stats]) => ({
      operationName,
      avgDuration: Math.round(stats.total / Math.max(stats.count, 1)),
      maxDuration: stats.max,
      count: stats.count,
    }))
    .sort((a, b) => {
      if (b.avgDuration !== a.avgDuration) return b.avgDuration - a.avgDuration
      return a.operationName.localeCompare(b.operationName)
    })
    .slice(0, 8)

  return (
    <section className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-8 shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400/80">Overview</p>
      <h1 className="page-title mt-3 text-4xl tracking-tight text-zinc-50">Traces</h1>
      <div className="mt-4 h-px w-28 bg-linear-to-r from-emerald-400/80 to-transparent" />
      {!loading ? (
        <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-300/80">
                Task Durations
              </p>
              <h2 className="text-lg font-semibold text-zinc-100">Top slow tasks (by average span duration)</h2>
            </div>
            <span className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-400">
              {topTaskDurations.length} shown
            </span>
          </div>

          {topTaskDurations.length === 0 ? (
            <p className="text-sm text-zinc-400">No span timing data available yet.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {topTaskDurations.map((task) => (
                <div
                  key={task.operationName}
                  className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-2 text-sm font-semibold text-emerald-200">{task.operationName}</p>
                    <span className="shrink-0 rounded border border-zinc-700 bg-zinc-950 px-1.5 py-0.5 text-[11px] text-zinc-400">
                      {task.count}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded border border-zinc-800 bg-zinc-950/70 px-2 py-1.5">
                      <div className="uppercase tracking-wide text-zinc-500">Avg</div>
                      <div className={`mt-1 font-medium ${getAbsoluteDurationColorClass(task.avgDuration)}`}>
                        {formatDuration(task.avgDuration)}
                      </div>
                    </div>
                    <div className="rounded border border-zinc-800 bg-zinc-950/70 px-2 py-1.5">
                      <div className="uppercase tracking-wide text-zinc-500">Max</div>
                      <div className={`mt-1 font-medium ${getAbsoluteDurationColorClass(task.maxDuration)}`}>
                        {formatDuration(task.maxDuration)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
      {loading ? (
        <ul className="mt-5 space-y-3">
          {[0, 1, 2].map((idx) => (
            <li key={idx} className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
              <div className="h-4 w-40 animate-pulse rounded bg-zinc-800" />
              <div className="mt-3 h-3 w-24 animate-pulse rounded bg-zinc-800/80" />
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <p className="mt-5 text-sm text-rose-300">{error}</p> : null}
      {!loading ? <ul className="mt-5 space-y-3">
        {Object.entries(services)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([serviceName, traces]) => (
          (() => {
            return (
              <li key={serviceName} className="rounded-lg border border-zinc-800 bg-zinc-950/70 text-sm text-zinc-200">
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded text-xs text-zinc-400 transition-transform group-open:rotate-90">
                        <i className="fa-solid fa-chevron-right"></i>
                      </span>
                      <div className="min-w-0 flex items-center gap-2">
                        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-emerald-500/25 bg-emerald-500/10 text-emerald-300">
                          <i className="fa-solid fa-cube text-xs"></i>
                        </span>
                        <span className="truncate rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 font-semibold tracking-tight text-emerald-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                          {serviceName}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-zinc-400">{traces.length} traces</div>
                      <div className="text-[11px] uppercase tracking-wide text-zinc-500">Click to expand</div>
                    </div>
                  </summary>
                  <div className="border-t border-zinc-800 px-4 py-3">
                    {traces.length === 0 ? (
                      <p className="text-zinc-400">No traces found.</p>
                    ) : (
                      <ul className="space-y-2">
                        {[...traces]
                          .sort((a, b) => {
                            const byRootStartTime = getTraceRootStartTime(a) - getTraceRootStartTime(b)
                            if (byRootStartTime !== 0) return byRootStartTime
                            return a.traceID.localeCompare(b.traceID)
                          })
                          .map((trace) => {
                          const { roots, childrenByParent } = buildSpanHierarchy(trace.spans)

                          const renderSpanRows = (span: Span, depth: number): ReactNode[] => {
                            const childSpans = childrenByParent.get(span.spanID) ?? []

                            const currentRow = (
                              <li
                                key={span.spanID}
                                className="grid grid-cols-[minmax(0,1fr)_120px_200px] gap-x-4 items-center px-2.5 py-1.5 odd:bg-zinc-950/60"
                              >
                                <div
                                  className={`flex min-w-0 items-center pr-4 ${getOperationTextColorClass(depth)}`}
                                  style={{ paddingLeft: `${depth * 16}px` }}
                                >
                                  {depth > 0 ? <span className="mr-2 shrink-0 text-zinc-500">↳</span> : null}
                                  <span className="truncate">{span.operationName || 'Unknown operation'}</span>
                                </div>
                                <span className={`shrink-0 text-right text-xs ${getAbsoluteDurationColorClass(span.duration)}`}>
                                  {formatDuration(span.duration)}
                                </span>
                                <span className="shrink-0 text-xs text-zinc-400">{formatStartTime(span.startTime)}</span>
                              </li>
                            )

                            return [currentRow, ...childSpans.flatMap((childSpan) => renderSpanRows(childSpan, depth + 1))]
                          }

                          return (
                            <li
                              key={trace.traceID}
                              className="rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2"
                            >
                              <div className="mb-2 text-xs text-zinc-400">Trace {trace.traceID}</div>
                              {roots.length === 0 ? (
                                <p className="text-zinc-400">No spans in this trace.</p>
                              ) : (
                                <div className="rounded border border-zinc-800/80 bg-zinc-950/70">
                                  <div className="grid grid-cols-[minmax(0,1fr)_120px_200px] gap-x-4 border-b border-zinc-800/80 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                                    <span>Operation Name</span>
                                    <span className="text-right">Duration</span>
                                    <span>Start Time</span>
                                  </div>
                                  <ul>
                                    {roots.flatMap((rootSpan) => renderSpanRows(rootSpan, 0))}
                                  </ul>
                                </div>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                </details>
              </li>
            )
          })()
          ))}
      </ul> : null}
    </section>
  )
}
