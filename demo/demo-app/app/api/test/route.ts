import { codeLocation } from "@/lib/tracing";
import { trace } from "@opentelemetry/api";

export async function GET(request: Request) {
  const tracer = trace.getTracer("products-api");

  return await tracer.startActiveSpan("get-products", async (span) => {
    try {
      // Parse query parameters
      const url = new URL(request.url);
      const category = url.searchParams.get("category");

      span.setAttribute("query.category", category || "all");

      // Database query with dedicated span
      const products = await tracer.startActiveSpan(
        "db.query.products",
        async (dbSpan) => {
          dbSpan.setAttribute("db.system", "postgresql");
          dbSpan.setAttribute("db.operation", "SELECT");
          dbSpan.setAttribute("db.table", "products");

          const startTime = Date.now();

          const result = [{ id: 1, name: "Product 1", price: 100 }];

          const duration = Date.now() - startTime;
          dbSpan.setAttribute("db.duration_ms", duration);
          dbSpan.setAttribute("db.rows_returned", result.length);

          dbSpan.end();
          return result;
        }
      );

      // Transform data with separate span
      const transformed = await tracer.startActiveSpan(
        "transform.products",
        { attributes: codeLocation() },
        async (transformSpan) => {
          const result = products.map((p) => ({
            id: p.id,
            name: p.name,
            price: p.price,
            // Expensive transformation
            formattedPrice: new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
            }).format(p.price),
          }));

          transformSpan.setAttribute("transform.count", result.length);

          transformSpan.setStatus({ code: 1 }); // OK

          transformSpan.end();
          return result;
        }
      );

      span.setAttribute("response.count", transformed.length);
      span.setStatus({ code: 1 }); // OK

      return Response.json(transformed);
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: 2, message: (error as Error).message }); // ERROR
      return Response.json(
        { error: "Failed to fetch products" },
        { status: 500 }
      );
    } finally {
      span.end();
    }
  });
}
