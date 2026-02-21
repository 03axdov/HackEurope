import "./otel"; // must be first — registers PrismaInstrumentation before PrismaClient is created
import express, { Request, Response } from "express";
import { trace } from "@opentelemetry/api";
import { prisma } from "./lib/prisma";

const app = express();
const port = 4000;

const tracer = trace.getTracer("Application");

app.get("/", async (_req: Request, res: Response) => {
  await tracer.startActiveSpan("simple-query", async (span) => {
    try {
      await prisma.user.create({
        data: {
          id: Math.floor(Math.random() * 1000000),
          name: 'John Doe',
          email: `john.doe${Math.floor(Math.random() * 1000000)}@example.com`,
          posts: {
            create: {
              title: 'Post 1',
              content: 'Content 1',
            },
          },
        },
      });
      let users = await prisma.user.findMany();
      res.status(200).json(users);
      span.setAttribute("http.status", 200);
    } catch (e) {
      span.setAttribute("http.status", 500);
      res.status(500).json({ error: 500, details: e });
    } finally {
      span.end();
    }
  });
});

app.get("/many", async (_req: Request, res: Response) => {
  tracer.startActiveSpan("lots-of-nested-queries", async (span) => {
    try {
      let users = await prisma.user.findMany();

      // let promises = users.map(({ id }) =>
      //   prisma.post.count({ where: { userId: id } })
      // );

      // let results = await Promise.all(promises);
      await tracer.startActiveSpan("raw-sleep", async (span) => {
        try {
          let r1 = prisma.$executeRaw`SELECT pg_sleep(1);`;
          let r2 = prisma.$executeRaw`SELECT pg_sleep(0.3);`;
          await Promise.allSettled([r1, r2]);
        } finally {
          span.end();
        }
      });

      await tracer.startActiveSpan("upsert", async (span) => {
        try {
          await prisma.user.upsert({
            create: { name: "bob", id: 6, email: 'bob@example.com' },
            update: { name: "hello - bob" },
            where: { id: 6 },
          });
        } finally {
          span.end();
        }
      });
      let results = await tracer.startActiveSpan("itx", async (span) => {
        try {
          let p1 = prisma
            .$transaction(
              async (tx) => {
                await tx.$executeRaw`SELECT pg_sleep(0.1);`;
              },
              { timeout: 30000 }
            )
            .catch((err) => {
              console.log("tx err", err);
            });

          let p2 = prisma.user.findMany({
            include: {
              posts: true,
            },
          });

          await Promise.allSettled([p1, p2]);
        } finally {
          span.end();
        }
      });

      res.status(200).json({ count: results });
    } catch (e) {
      console.log("ERR", e);
      res.status(500).json(e);
    } finally {
      span.end();
    }
  });
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});