import path from 'path'
import type { Express, NextFunction, Request, Response } from 'express'
import { Context, context, trace } from '@opentelemetry/api'
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { BasicTracerProvider, ReadableSpan, Span, SpanProcessor, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions'
import { PrismaInstrumentation } from '@prisma/instrumentation'
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'

import dotenv from "dotenv";
dotenv.config();

class CodeLocationSpanProcessor implements SpanProcessor {
  onStart(span: Span, _parentContext: Context): void {
    const rawStack = new Error().stack ?? ''
    const frames = rawStack
      .split('\n')
      .slice(1)
      .filter(line =>
        !line.includes('node_modules') &&
        !line.includes('otel.ts') &&
        !line.trimStart().startsWith('at node:') &&
        (line.includes('.ts') || line.includes('.js'))
      )
      .map(line => {
        // Make absolute paths relative so the stack is portable/readable
        return line.replace(/\(?(\/[^\s:]+)/g, (_, p) => `(${path.relative(process.cwd(), p)}`)
      })

    if (frames.length === 0) return

    // Top frame → individual attributes
    // Matches: "at functionName (file:line:col)" or "at file:line:col"
    const match = frames[0].match(/at (?:(.+?) \()?(.+?):(\d+):\d+\)?/)
    if (match) {
      const [, fnName, filePath, lineNo] = match
      span.setAttribute('code.filepath', filePath)
      span.setAttribute('code.lineno', parseInt(lineNo, 10))
      span.setAttribute('code.location', `${filePath}:${lineNo}`)
      if (fnName) span.setAttribute('code.function', fnName)
    }

    // Full user-code stack trace
    span.setAttribute('code.stacktrace', frames.join('\n'))
  }

  onEnd(_span: ReadableSpan): void {}
  shutdown(): Promise<void> { return Promise.resolve() }
  forceFlush(): Promise<void> { return Promise.resolve() }
}

const contextManager = new AsyncLocalStorageContextManager().enable()

context.setGlobalContextManager(contextManager)

const otlpTraceExporter = new OTLPTraceExporter({
  url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
})

const provider = new BasicTracerProvider({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'test-tracing-service',
    [ATTR_SERVICE_VERSION]: '1.0.0',
  }),
  spanProcessors: [
    new CodeLocationSpanProcessor(),
    new SimpleSpanProcessor(otlpTraceExporter),
  ],
})

trace.setGlobalTracerProvider(provider)

registerInstrumentations({
  instrumentations: [getNodeAutoInstrumentations(), new PrismaInstrumentation(), new ExpressInstrumentation()],
})

/**
 * Wraps an Express app so that every route registered via app.get/post/put/delete/patch/all
 * captures the source location at registration time and stamps it onto the active OTel span
 * at request time (as code.filepath, code.lineno, code.location, code.stacktrace).
 *
 * Call this immediately after `const app = express()`, before registering any routes.
 */
export function wrapExpressApp(app: Express): void {
  const httpMethods = ['get', 'post', 'put', 'delete', 'patch', 'all'] as const

  for (const method of httpMethods) {
    const original = (app as any)[method].bind(app)

    ;(app as any)[method] = function (routePath: any, ...handlers: any[]) {
      // app.get() doubles as a settings getter when called with no handlers — pass through as-is
      if (handlers.length === 0) return original(routePath)

      const rawStack = new Error().stack ?? ''
      const frames = rawStack
        .split('\n')
        .slice(1)
        // .filter(line =>
        //   !line.includes('node_modules') &&
        //   !line.includes('otel.ts') &&
        //   !line.trimStart().startsWith('at node:') &&
        //   (line.includes('.ts') || line.includes('.js'))
        // )
        .map(line => line.replace(/\(?(\/[^\s:]+)/g, (_, p) => `(${path.relative(process.cwd(), p)}`))

      const locationMiddleware = (_req: Request, _res: Response, next: NextFunction) => {
        const span = trace.getActiveSpan()
        if (span && frames.length > 0) {
          const match = frames[0].match(/at (?:(.+?) \()?(.+?):(\d+):\d+\)?/)
          if (match) {
            const [, fnName, filePath, lineNo] = match
            span.setAttribute('code.filepath', filePath)
            span.setAttribute('code.lineno', parseInt(lineNo, 10))
            span.setAttribute('code.location', `${filePath}:${lineNo}`)
            if (fnName) span.setAttribute('code.function', fnName)
          }
          span.setAttribute('code.stacktrace', frames.join('\n'))
        }
        next()
      }

      return original(routePath, locationMiddleware, ...handlers)
    }
  }
}