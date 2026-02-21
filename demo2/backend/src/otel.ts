import { context, trace } from '@opentelemetry/api'
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { BasicTracerProvider, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions'
import { PrismaInstrumentation } from '@prisma/instrumentation'
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'

import dotenv from "dotenv";
dotenv.config();

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
  spanProcessors: [new SimpleSpanProcessor(otlpTraceExporter)],
})

trace.setGlobalTracerProvider(provider)

registerInstrumentations({
  instrumentations: [getNodeAutoInstrumentations(), new PrismaInstrumentation(), new ExpressInstrumentation()],
})