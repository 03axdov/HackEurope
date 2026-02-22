export type Incident = {
  id: number
  pullRequest: number | null
  url: string
  severity: 'low' | 'medium' | 'high' | 'critical' | 'blocker'
  title: string
  problemDescription: string
  solutionDescription: string
  timeImpact: number
  impactCount: number
}
