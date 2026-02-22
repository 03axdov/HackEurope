import type { Trace } from '../types/Trace'
import type { PullRequest } from '../types/PullRequest'
import type { Incident } from '../types/Incident'
import type { LogEntry } from '../types/Log'
import type { DetectionRun } from '../types/DetectionRun'

export async function get_services() {
  const response = await fetch('/jaeger-api/api/services')

  if (!response.ok) {
    throw new Error(`Failed to fetch services: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

type TracesResponse = {
  data: Trace[]
}

export async function get_traces(service_name: string, limit: number): Promise<Trace[]> {
  const params = new URLSearchParams({
    service: service_name,
    limit: String(limit),
  })
  const response = await fetch(`/jaeger-api/api/traces?${params.toString()}`)

  if (!response.ok) {
    throw new Error(`Failed to fetch traces: ${response.status} ${response.statusText}`)
  }
  const result = (await response.json()) as TracesResponse
  return Array.isArray(result?.data) ? result.data : []
}

export async function get_pull_requests(): Promise<PullRequest[]> {
  const response = await fetch('/backend-api/pull-requests/')
  if (!response.ok) {
    throw new Error(`Failed to fetch pull requests: ${response.status} ${response.statusText}`)
  }

  const result = (await response.json()) as PullRequest[]
  return Array.isArray(result) ? result : []
}


export async function get_incidents(): Promise<Incident[]> {
  const response = await fetch('/backend-api/incidents/')
  if (!response.ok) {
    throw new Error(`Failed to fetch incidents: ${response.status} ${response.statusText}`)
  }

  const result = (await response.json()) as Incident[]
  return Array.isArray(result) ? result : []
}

export async function detect_incidents() {
  const response = await fetch('/backend-api/incidents/detect/', {
    method: 'POST',
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Failed to detect incidents: ${response.status} ${text}`)
  }

  return response.json() as Promise<{ data: Record<string, unknown>; count: number }>
}

export async function merge_pull_request(id: number) {
  const response = await fetch(`/backend-api/pull-requests/${id}/merge-pr/`, {
    method: 'POST',
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Failed to merge pull request: ${response.status} ${text}`)
  }

  return response.json()
}

export async function get_logs(): Promise<LogEntry[]> {
  const response = await fetch('/backend-api/logs/?limit=500')
  if (!response.ok) {
    throw new Error(`Failed to fetch logs: ${response.status} ${response.statusText}`)
  }

  const result = (await response.json()) as LogEntry[]
  return Array.isArray(result) ? result : []
}

export async function get_detection_runs(): Promise<DetectionRun[]> {
  const response = await fetch('/backend-api/detection-runs/?limit=12')
  if (!response.ok) {
    throw new Error(`Failed to fetch detection runs: ${response.status} ${response.statusText}`)
  }

  const result = (await response.json()) as DetectionRun[]
  return Array.isArray(result) ? result : []
}

export async function delete_incident(id: number) {
  const response = await fetch(`/backend-api/incidents/${id}/`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Failed to delete incident: ${response.status} ${text}`)
  }
}
