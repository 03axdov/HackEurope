export type TraceTag = {
  key: string
  type: string
  value: string | number | boolean | null
}

export type SpanReferenceType = 'CHILD_OF' | 'FOLLOWS_FROM' | string

export type SpanReference = {
  refType: SpanReferenceType
  traceID: string
  spanID: string
}

export type Span = {
  traceID: string
  spanID: string
  parentSpanID?: string
  operationName: string
  startTime: number
  duration: number
  references: SpanReference[]
  tags: TraceTag[]
  logs: unknown[]
  processID: string
  warnings: string[] | null
}

export type Trace = {
  traceID: string
  spans: Span[]
}
