export type LogLevel = 'info' | 'warning' | 'error'

export type LogEntry = {
  id: number
  run_id: string
  source: string
  step: string
  level: LogLevel
  message: string
  context: Record<string, unknown>
  incident: number | null
  pull_request: number | null
  created_at: string
}
