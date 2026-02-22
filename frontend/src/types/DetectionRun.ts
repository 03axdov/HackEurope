export type DetectionRun = {
  id: number
  date: string
  runType: 'manual' | 'automatic'
  status: 'success' | 'failure'
  incidentCount: number
  errorMessage: string
}
