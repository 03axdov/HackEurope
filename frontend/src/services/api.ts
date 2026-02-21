import type { Trace } from '../types/Trace'
import type { PullRequest } from '../types/PullRequest'

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

export async function create_suggested_pull_request(id: number) {
  const response = await fetch(`/backend-api/pull-requests/${id}/create-pr/`, {
    method: 'POST',
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Failed to create pull request: ${response.status} ${text}`)
  }

  return response.json()
}
