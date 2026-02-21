import FetchProductsButton from "@/app/components/FetchProductsButton";
import { getNeo4jStatus } from "@/lib/neo4j";
import { prisma } from "@/lib/prisma";
import { trace } from "@opentelemetry/api";

const tracer = trace.getTracer("demo-app");

export default async function Home() {
  const status = await getNeo4jStatus();
  const neo4j = {
    ok: status.ok,
    message: status.message,
  };

  const products = await prisma.product.findMany();
  console.log(products);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-8 font-sans dark:bg-black">
      <main className="w-full max-w-2xl rounded-2xl bg-white p-8 shadow-sm dark:bg-zinc-900">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Demo App
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-300">
          Neo4j integration is configured server-side with the official
          JavaScript driver.
        </p>

        <section className="mt-6 rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
          <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Neo4j Status
          </h2>
          <p
            className={`mt-2 text-lg font-medium ${
              neo4j.ok
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-amber-600 dark:text-amber-400"
            }`}
          >
            {neo4j.ok ? "Connected" : "Not connected"}
          </p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
            {neo4j.message}
          </p>
        </section>

        <FetchProductsButton />
      </main>
    </div>
  );
}
