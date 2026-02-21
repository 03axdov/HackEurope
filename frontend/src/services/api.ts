import type { Trace } from '../types/Trace'

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
