import sourceMapSupport from "source-map-support";
sourceMapSupport.install();

// import * as Sentry from '@sentry/node';

import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { PrismaInstrumentation } from "@prisma/instrumentation";

const exporterUrl = process.env.OTEL_EXPORTER_OTLP_ENDPOINT

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? "demo-app",
  }),
  spanProcessor: new SimpleSpanProcessor(
    new OTLPTraceExporter({
      url: exporterUrl,
    }),
  ),
  instrumentations: [new PrismaInstrumentation()],
});

sdk.start();

// Handle graceful shutdown
process.on("SIGTERM", async () => {
  try {
    await sdk.shutdown();
    console.log("Tracing shut down successfully");
  } catch (err) {
    console.error("Error shutting down tracing", err);
  } finally {
    process.exit(0);
  }
});

// Sentry.init({
//   dsn: exporterUrl,
//   // dsn: isProduction
//   //   ? 'https://SnuwUh4gmHwEgpjxLKmuB4DF@s1697863.eu-fsn-3.betterstackdata.com/1697863'
//   //   : 'https://EXb7vX5PXNDWf3CMumJ56GWu@s1615119.eu-nbg-2.betterstackdata.com/1615119',
//   enabled: true,
//   // Adds request headers and IP for users, for more info visit:
//   // https://docs.sentry.io/platforms/javascript/guides/hono/configuration/options/#sendDefaultPii
//   sendDefaultPii: true,
//   // Set the release to the git commit hash for better debugging
//   // release: env.GIT_REV,
//   // Set the environment for filtering errors
//   environment: 'production',
//   // Sample rate for performance monitoring (1.0 = 100%)
//   tracesSampleRate: 1.0,
// })

// export { Sentry };
