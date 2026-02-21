import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { SimpleSpanProcessor } from "@opentelemetry/sdk-trace-node";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

const exporterUrl =
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT ??
  "https://in-otel.logs.betterstack.com/v1/traces";

const headers = {};
if (process.env.BS_SOURCE_TOKEN) {
  headers["Authorization"] = `Bearer ${process.env.BS_SOURCE_TOKEN}`;
}

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? "demo-app",
  }),
  spanProcessor: new SimpleSpanProcessor(
    new OTLPTraceExporter({
      url: exporterUrl,
      headers,
    }),
  ),
});

sdk.start();
