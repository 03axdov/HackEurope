import { useState } from 'react'

type TimingOption = 'critical_only' | 'high_and_up' | 'daily_summary' | 'all_incidents'

export default function NotificationsPage() {
  const [emailEnabled, setEmailEnabled] = useState(true)
  const [emailAddress, setEmailAddress] = useState('alerts@optimera.dev')
  const [timingOption, setTimingOption] = useState<TimingOption>('high_and_up')
  const [includeResolved, setIncludeResolved] = useState(true)

  return (
    <section className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-8 shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-400/80">Preferences</p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <h1 className="page-title text-4xl tracking-tight text-zinc-50">Notifications</h1>
        <span className="pb-1 text-sm text-zinc-500">Skeleton UI (not wired yet)</span>
      </div>
      <div className="mt-4 h-px w-28 bg-linear-to-r from-fuchsia-400/80 to-transparent" />

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-fuchsia-300/80">
                Delivery Channel
              </p>
              <h2 className="mt-1 text-lg font-semibold text-zinc-100">Email notifications</h2>
            </div>
            <button
              type="button"
              onClick={() => setEmailEnabled((prev) => !prev)}
              className={`flex cursor-pointer items-center gap-2 rounded border px-3 py-1.5 text-sm transition ${
                emailEnabled
                  ? 'border-fuchsia-500/30 bg-fuchsia-500/15 text-fuchsia-200'
                  : 'border-zinc-700 bg-zinc-900 text-zinc-300'
              }`}
              aria-pressed={emailEnabled}
            >
              <i className={`fa-solid ${emailEnabled ? 'fa-envelope-circle-check' : 'fa-envelope-circle-xmark'}`}></i>
              {emailEnabled ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          <div className="mt-4">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
              Email Address
            </label>
            <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 py-2">
              <i className="fa-solid fa-at text-xs text-zinc-500"></i>
              <input
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
                disabled={!emailEnabled}
                placeholder="you@example.com"
                className="w-full bg-transparent text-sm text-zinc-200 outline-none placeholder:text-zinc-500 disabled:cursor-not-allowed disabled:text-zinc-500"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
              Notify Me When
            </label>
            <div className="space-y-2">
              {[
                { value: 'critical_only', label: 'Critical incidents only', detail: 'Only the most severe issues' },
                { value: 'high_and_up', label: 'High severity and above', detail: 'Recommended for active monitoring' },
                { value: 'daily_summary', label: 'Daily summary', detail: 'One digest email per day' },
                { value: 'all_incidents', label: 'All detected incidents', detail: 'Every detected issue' },
              ].map((option) => {
                const active = timingOption === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setTimingOption(option.value as TimingOption)}
                    disabled={!emailEnabled}
                    className={`flex w-full cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      active
                        ? 'border-fuchsia-500/30 bg-fuchsia-500/10'
                        : 'border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900'
                    }`}
                  >
                    <div>
                      <div className={`text-sm font-medium ${active ? 'text-fuchsia-200' : 'text-zinc-200'}`}>
                        {option.label}
                      </div>
                      <div className="mt-0.5 text-xs text-zinc-500">{option.detail}</div>
                    </div>
                    <span
                      className={`relative inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                        active
                          ? 'border-fuchsia-400/30 bg-fuchsia-500/15 text-fuchsia-300'
                          : 'border-zinc-700 text-zinc-500'
                      }`}
                    >
                      {active ? (
                        <span className="absolute flex items-center justify-center">
                          <span className="h-2 w-2 rounded-full bg-fuchsia-300 shadow-[0_0_8px_rgba(232,121,249,0.35)]" />
                        </span>
                      ) : null}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-fuchsia-300/80">
            Additional Options
          </p>
          <h2 className="mt-1 text-lg font-semibold text-zinc-100">Notification rules</h2>

          <div className="mt-4 space-y-3">
            <button
              type="button"
              onClick={() => setIncludeResolved((prev) => !prev)}
              className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-left hover:bg-zinc-900"
            >
              <div>
                <div className="text-sm font-medium text-zinc-200">Include resolved updates</div>
                <div className="text-xs text-zinc-500">Notify when suggested fixes are merged/resolved</div>
              </div>
              <span className={`text-xs font-semibold ${includeResolved ? 'text-emerald-300' : 'text-zinc-500'}`}>
                {includeResolved ? 'On' : 'Off'}
              </span>
            </button>

            <button
              type="button"
              disabled
              className="flex w-full cursor-not-allowed items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-left opacity-60"
              title="Quiet hours is not available yet"
            >
              <div>
                <div className="text-sm font-medium text-zinc-200">Quiet hours</div>
                <div className="text-xs text-zinc-500">Pause notifications overnight (coming later)</div>
              </div>
              <span className="text-xs font-semibold text-zinc-500">Unavailable</span>
            </button>
          </div>

          <div className="mt-5 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Current Setup</p>
            <ul className="mt-2 space-y-1.5 text-sm text-zinc-300">
              <li>Email: {emailEnabled ? emailAddress || 'No address set' : 'Disabled'}</li>
              <li>Trigger: {timingOption.replaceAll('_', ' ')}</li>
              <li>Resolved updates: {includeResolved ? 'Included' : 'Excluded'}</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
