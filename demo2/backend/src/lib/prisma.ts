import "dotenv/config";
import path from "path";
import { AsyncLocalStorage } from "async_hooks";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";
import { tracer } from "../tracer";

const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });

const callSiteStorage = new AsyncLocalStorage<string>();

function captureUserStack(): string {
  const obj: { stack?: string } = {};
  Error.captureStackTrace(obj);
  return (obj.stack ?? "")
    .split("\n")
    .slice(1)
    .filter(
      (line) =>
        !line.includes("node_modules") &&
        !line.includes("prisma.ts") &&
        !line.trimStart().startsWith("at node:")
    )
    .join("\n");
}

function withCallSite<T extends (...args: any[]) => any>(
  fn: T,
  thisArg: unknown
): T {
  return function (this: unknown, ...args: any[]) {
    const stack = captureUserStack();
    const result = fn.apply(thisArg, args) as any;

    // Prisma returns a lazy "PrismaPromise" that doesn't execute until .then() is called
    // (at the `await` in the caller). By that point, callSiteStorage.run() has already
    // exited, so the async context is lost. Patching .then() re-establishes it at the
    // exact moment Prisma starts executing the query.
    if (
      result !== null &&
      typeof result === "object" &&
      typeof result.then === "function"
    ) {
      const originalThen = result.then.bind(result);
      result.then = (onFulfilled?: any, onRejected?: any) =>
        callSiteStorage.run(stack, () => originalThen(onFulfilled, onRejected));
    }

    return result;
  } as T;
}

function createProxy<T extends object>(target: T, depth = 0): T {
  return new Proxy(target, {
    get(obj, prop) {
      const value = (obj as any)[prop];
      if (typeof value === "function") {
        return withCallSite(value, obj);
      }
      if (depth === 0 && value !== null && typeof value === "object") {
        return createProxy(value, 1);
      }
      return value;
    },
  });
}

const baseClient = new PrismaClient({ adapter }).$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const callSite = callSiteStorage.getStore();

        const frames = callSite?.split("\n").map((line) => {
          // Make absolute paths relative so the stack is portable/readable
          return line.replace(
            /\(?(\/[^\s:]+)/g,
            (_, p) => `(${path.relative(process.cwd(), p)}`
          );
        });
        const frame = frames?.[0];
        console.log(
          `Executing ${operation} on ${model} — called from:\n${frame}`
        );

        return tracer.startActiveSpan(`prisma:call-operation`, async (span) => {
          span
            .setAttribute("prisma.model", model)
            .setAttribute("prisma.operation", operation)
            .setAttribute("prisma.args", JSON.stringify(args))
            .setAttribute("prisma.frame", frame ?? "N/A");

          const result = await query(args);
          span.end();
          return result;
        });
      },
    },
  },
});

export const prisma = createProxy(baseClient);
