export type Incident = {
  id: number
  pullRequest: number | null
  title: string
  problemDescription: string
  solutionDescription: string
  timeImpact: number
  impactCount: number
}
