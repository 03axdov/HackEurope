type Severity = 'low' | 'medium' | 'high' | 'critical' | 'blocker'

const monthlySeverity = [
  { month: 'Sep', low: 6, medium: 9, high: 5, critical: 2, blocker: 1 },
  { month: 'Oct', low: 8, medium: 11, high: 6, critical: 3, blocker: 1 },
  { month: 'Nov', low: 7, medium: 10, high: 7, critical: 4, blocker: 2 },
  { month: 'Dec', low: 5, medium: 8, high: 6, critical: 3, blocker: 1 },
  { month: 'Jan', low: 9, medium: 13, high: 8, critical: 4, blocker: 2 },
  { month: 'Feb', low: 11, medium: 14, high: 9, critical: 5, blocker: 2 },
]

const codeAreas = [
  { area: 'Auth / Session', incidents: 18, avgImpactPct: 29, files: ['auth.ts', 'middleware.ts'] },
  { area: 'Product Queries', incidents: 24, avgImpactPct: 41, files: ['prisma/products.ts', 'catalog.service.ts'] },
  { area: 'Checkout Flow', incidents: 12, avgImpactPct: 37, files: ['checkout.tsx', 'payments.ts'] },
  { area: 'User Profile', incidents: 9, avgImpactPct: 16, files: ['users.controller.ts', 'profile.tsx'] },
  { area: 'Reporting Jobs', incidents: 7, avgImpactPct: 52, files: ['reports.worker.ts', 'cron.ts'] },
]

const endpointHotspots = [
  { label: '/api/products', count: 19, p95Ms: 1280 },
  { label: '/api/auth/login', count: 13, p95Ms: 920 },
  { label: '/api/checkout/confirm', count: 11, p95Ms: 2140 },
  { label: '/api/users/me', count: 8, p95Ms: 640 },
  { label: '/api/reports/export', count: 6, p95Ms: 4310 },
]

const weeklyHeat = [
  1, 0, 2, 3, 1, 0, 1,
  0, 2, 1, 4, 3, 1, 0,
  1, 2, 2, 5, 4, 2, 1,
  0, 1, 3, 4, 2, 1, 0,
  2, 3, 2, 5, 3, 2, 1,
  1, 2, 4, 6, 4, 2, 1,
  0, 1, 2, 3, 2, 1, 0,
  1, 2, 3, 4, 3, 1, 1,
]

const rootCauses = [
  { label: 'N+1 queries', share: 31 },
  { label: 'Unbounded list fetch', share: 22 },
  { label: 'Missing cache / memoization', share: 18 },
  { label: 'Inefficient joins / aggregations', share: 15 },
  { label: 'Serialization overhead', share: 8 },
  { label: 'Other', share: 6 },
]

const fixOutcomes = {
  merged: 42,
  rejected: 11,
  pending: 9,
}

const heatGridStartDate = new Date('2026-01-01T00:00:00Z')

function severityColor(severity: Severity) {
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

function severityText(severity: Severity) {
  switch (severity) {
    case 'low':
      return 'text-emerald-300'
    case 'medium':
      return 'text-yellow-300'
    case 'high':
      return 'text-orange-300'
    case 'critical':
      return 'text-rose-300'
    case 'blocker':
      return 'text-red-300'
    default:
      return 'text-zinc-300'
  }
}

function formatHeatDate(index: number) {
  const d = new Date(heatGridStartDate)
  d.setUTCDate(d.getUTCDate() + index)
  return d.toISOString().slice(0, 10)
}

function rootCauseColor(index: number) {
  const colors = [
    '#22d3ee', // cyan-400
    '#60a5fa', // blue-400
    '#818cf8', // indigo-400
    '#c084fc', // purple-400
    '#f472b6', // pink-400
    '#a1a1aa', // zinc-400
  ]
  return colors[index % colors.length]
}

export default function StatisticsPage() {
  const maxAreaIncidents = Math.max(...codeAreas.map((a) => a.incidents), 1)
  const maxHotspotCount = Math.max(...endpointHotspots.map((e) => e.count), 1)
  const maxWeekValue = Math.max(...weeklyHeat, 1)
  const totalOutcomes = fixOutcomes.merged + fixOutcomes.rejected + fixOutcomes.pending
  const monthlyTotals = monthlySeverity.map((m) => ({
    month: m.month,
    total: m.low + m.medium + m.high + m.critical + m.blocker,
  }))
  const maxMonthlyTotal = Math.max(...monthlyTotals.map((m) => m.total), 1)
  const rootCausePie = rootCauses.reduce(
    (acc, cause, idx) => {
      const start = acc.offset
      const end = start + cause.share
      acc.offset = end
      acc.stops.push(`${rootCauseColor(idx)} ${start}% ${end}%`)
      return acc
    },
    { offset: 0, stops: [] as string[] },
  )
  const rootCausePieBackground = `conic-gradient(${rootCausePie.stops.join(', ')})`

  return (
    <section className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-8 shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400/80">Insights</p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <h1 className="page-title text-4xl tracking-tight text-zinc-50">Statistics</h1>
        <span className="pb-1 text-sm text-zinc-500">Fake historical data for UI exploration</span>
      </div>
      <div className="mt-4 h-px w-28 bg-linear-to-r from-cyan-400/80 to-transparent" />

      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Incidents (90d)</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-100">126</p>
          <p className="mt-1 text-xs text-emerald-300">+8% detection coverage</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Median Resolution</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-100">2.6d</p>
          <p className="mt-1 text-xs text-zinc-400">from suggestion to merge</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">PR Acceptance</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-100">79%</p>
          <p className="mt-1 text-xs text-cyan-300">merged / suggested fixes</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Avg Perf Gain</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-100">24%</p>
          <p className="mt-1 text-xs text-emerald-300">on accepted fixes</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300/80">Impact Map</p>
              <h2 className="text-lg font-semibold text-zinc-100">Incidents by code area</h2>
            </div>
            <span className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-400">
              hotspots
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {codeAreas.map((area) => (
              <div key={area.area} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-zinc-100">{area.area}</p>
                    <p className="mt-1 text-xs text-zinc-500">{area.files.join(' • ')}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-cyan-200">{area.incidents} incidents</div>
                    <div className="text-xs text-zinc-400">{area.avgImpactPct}% avg impact</div>
                  </div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full border border-zinc-800 bg-zinc-950">
                  <div
                    className="h-full rounded-full bg-linear-to-r from-cyan-500 via-blue-500 to-violet-500"
                    style={{ width: `${(area.incidents / maxAreaIncidents) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300/80">Root Causes</p>
          <h2 className="text-lg font-semibold text-zinc-100">What the agent keeps finding</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[180px_minmax(0,1fr)]">
            <div className="flex flex-col items-center justify-center">
              <div
                className="relative h-40 w-40 rounded-full border border-zinc-800 shadow-[0_0_18px_rgba(0,0,0,0.25)]"
                style={{ background: rootCausePieBackground }}
              >
                <div className="absolute inset-5 rounded-full border border-zinc-800 bg-zinc-950/95" />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">Top Cause</span>
                  <span className="mt-1 text-sm font-semibold text-zinc-100 text-center px-3">
                    {rootCauses[0]?.label}
                  </span>
                  <span className="mt-1 text-cyan-300 font-semibold">{rootCauses[0]?.share ?? 0}%</span>
                </div>
              </div>
              <p className="mt-3 text-xs text-zinc-500">Share of detected inefficiency patterns</p>
            </div>

            <div className="space-y-2">
              {rootCauses.map((cause, idx) => (
                <div key={cause.label}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                    <span className="inline-flex items-center gap-2 text-zinc-300">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: rootCauseColor(idx) }}
                      />
                      {cause.label}
                    </span>
                    <span className="text-zinc-500">{cause.share}%</span>
                  </div>
                  <div className="h-2 rounded-full border border-zinc-800 bg-zinc-950">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${cause.share}%`, backgroundColor: rootCauseColor(idx) }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300/80">Activity Grid</p>
          <h2 className="text-lg font-semibold text-zinc-100">Resolved incident intensity</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Weekly heat-style view (last ~8 weeks): {formatHeatDate(0)} to {formatHeatDate(weeklyHeat.length - 1)}
          </p>
          <div className="mt-4 grid grid-cols-7 gap-2">
            {weeklyHeat.map((value, idx) => {
              const intensity = value / maxWeekValue
              const bg =
                value === 0
                  ? 'bg-zinc-900'
                  : intensity < 0.34
                    ? 'bg-cyan-900/80'
                    : intensity < 0.67
                      ? 'bg-blue-700/80'
                      : 'bg-violet-600/85'
              return (
                <div
                  key={idx}
                  className={`group relative aspect-square rounded-md border border-zinc-800 ${bg}`}
                >
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 shadow-lg group-hover:block">
                    {formatHeatDate(idx)}: {value} resolved
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-500">
            <span>{formatHeatDate(0)}</span>
            <span>{formatHeatDate(weeklyHeat.length - 1)}</span>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300/80">Severity Trend</p>
              <h2 className="text-lg font-semibold text-zinc-100">Monthly distribution</h2>
            </div>
            <div className="flex flex-wrap gap-2 text-[11px]">
              {(['low', 'medium', 'high', 'critical', 'blocker'] as Severity[]).map((s) => (
                <span key={s} className={`inline-flex items-center gap-1 ${severityText(s)}`}>
                  <span className={`h-2 w-2 rounded-full ${severityColor(s)}`} />
                  {s}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
            <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.12em] text-zinc-500">
              <span>Total incidents by month</span>
              <span>Bar chart</span>
            </div>
            <div className="space-y-2">
              {monthlyTotals.map((m) => (
                <div key={`${m.month}-total`} className="grid grid-cols-[36px_minmax(0,1fr)_36px] items-center gap-2">
                  <span className="text-xs text-zinc-400">{m.month}</span>
                  <div className="h-2 overflow-hidden rounded-full border border-zinc-800 bg-zinc-950">
                    <div
                      className="h-full rounded-full bg-linear-to-r from-cyan-500 to-blue-500"
                      style={{ width: `${(m.total / maxMonthlyTotal) * 100}%` }}
                    />
                  </div>
                  <span className="text-right text-xs text-zinc-400">{m.total}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-6 gap-3 items-end">
            {monthlySeverity.map((m) => {
              const total = m.low + m.medium + m.high + m.critical + m.blocker
              return (
                <div key={m.month} className="group flex min-w-0 flex-col items-center gap-2">
                  <div className="relative flex h-28 w-full items-end rounded-lg border border-zinc-800 bg-zinc-900/60 p-1.5">
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden w-40 -translate-x-1/2 rounded-lg border border-zinc-700 bg-zinc-950 p-2 text-xs shadow-lg group-hover:block">
                      <div className="mb-1 font-semibold text-zinc-100">{m.month}</div>
                      <div className="space-y-1 text-zinc-300">
                        <div>Low: {m.low}</div>
                        <div>Medium: {m.medium}</div>
                        <div>High: {m.high}</div>
                        <div>Critical: {m.critical}</div>
                        <div>Blocker: {m.blocker}</div>
                      </div>
                    </div>
                    <div className="flex h-full w-full flex-col justify-end overflow-hidden rounded">
                      {(Object.entries({
                        blocker: m.blocker,
                        critical: m.critical,
                        high: m.high,
                        medium: m.medium,
                        low: m.low,
                      }) as [Severity, number][])
                        .filter(([, value]) => value > 0)
                        .map(([severity, value]) => (
                          <div
                            key={`${m.month}-${severity}`}
                            className={severityColor(severity)}
                            style={{ height: `${(value / total) * 100}%` }}
                          />
                        ))}
                    </div>
                  </div>
                  <div className="text-xs text-zinc-400">{m.month}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300/80">Endpoint Hotspots</p>
          <h2 className="text-lg font-semibold text-zinc-100">Where inefficiencies surface</h2>
          <div className="mt-4 space-y-3">
            {endpointHotspots.map((endpoint) => (
              <div key={endpoint.label} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-sm text-zinc-200">{endpoint.label}</span>
                  <span className="text-xs text-zinc-400">p95 {endpoint.p95Ms} ms</span>
                </div>
                <div className="mt-2 h-2 rounded-full border border-zinc-800 bg-zinc-950">
                  <div
                    className="h-full rounded-full bg-linear-to-r from-cyan-500 to-violet-500"
                    style={{ width: `${(endpoint.count / maxHotspotCount) * 100}%` }}
                  />
                </div>
                <div className="mt-1 text-xs text-zinc-500">{endpoint.count} incidents flagged</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300/80">Fix Outcome Mix</p>
          <h2 className="text-lg font-semibold text-zinc-100">What happens to suggested fixes</h2>
          <div className="mt-4 h-3 overflow-hidden rounded-full border border-zinc-800 bg-zinc-950">
            <div className="flex h-full">
              <div className="bg-emerald-500" style={{ width: `${(fixOutcomes.merged / totalOutcomes) * 100}%` }} />
              <div className="bg-rose-500" style={{ width: `${(fixOutcomes.rejected / totalOutcomes) * 100}%` }} />
              <div className="bg-zinc-500" style={{ width: `${(fixOutcomes.pending / totalOutcomes) * 100}%` }} />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
              <div className="text-xs uppercase tracking-[0.12em] text-zinc-500">Merged</div>
              <div className="mt-1 text-2xl font-semibold text-emerald-300">{fixOutcomes.merged}</div>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
              <div className="text-xs uppercase tracking-[0.12em] text-zinc-500">Rejected</div>
              <div className="mt-1 text-2xl font-semibold text-rose-300">{fixOutcomes.rejected}</div>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
              <div className="text-xs uppercase tracking-[0.12em] text-zinc-500">Pending</div>
              <div className="mt-1 text-2xl font-semibold text-zinc-200">{fixOutcomes.pending}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
