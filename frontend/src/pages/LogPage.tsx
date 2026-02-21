export default function LogPage() {
  return (
    <section className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-8 shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-400/80">Activity</p>
      <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-zinc-50">Logs</h1>
      <div className="mt-4 h-px w-28 bg-linear-to-r from-violet-400/80 to-transparent" />
    </section>
  )
}
