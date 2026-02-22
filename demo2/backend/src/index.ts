import { wrapExpressApp } from "./otel"; // must be first — registers PrismaInstrumentation before PrismaClient is created
import express, { Request, Response } from "express";
import cors from "cors";
import { trace } from "@opentelemetry/api";
import { prisma } from "./lib/prisma";
import { tracer } from "./tracer";
import { faker } from "@faker-js/faker";

const app = express();
app.use(cors());
wrapExpressApp(app);
const port = 4000;

app.get("/", async (_req: Request, res: Response) => {
  try {
    const user = await prisma.user.create({
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
      include: {
        posts: true,
      },
    });
    res.status(200).json(user);
  } catch (e) {
    res.status(500).json({ error: 500, details: e });
  }
});

app.get("/matches", async (_req: Request, res: Response) => {
  const matches = await prisma.match.findMany({
    take: 100,
    orderBy: {
      playedAt: "desc",
    },
    select: {
      modelA: {
        select: {
          name: true,
        },
      },
      modelB: {
        select: {
          name: true,
        },
      },
      winner: {
        select: {
          name: true,
        },
      },
      playedAt: true,
      durationMs: true,
      modelAMove: true,
      modelBMove: true,
    },
  });

  res.status(200).json(matches);
});

app.get("/leaderboards", async (_req: Request, res: Response) => {
  const models = await prisma.aIModel.findMany(); // Fetch all models

  const leaderboard = await Promise.all(
    models.map(async (model) => {
      const totalMatches = await prisma.match.findMany({
        where: { OR: [{ modelAId: model.id }, { modelBId: model.id }] },
      });

      const wins = totalMatches.filter((m) => m.winnerId === model.id).length;

      return {
        name: model.name,
        winRate: (wins / totalMatches.length) * 100,
      };
    })
  );

  leaderboard.sort((a, b) => b.winRate - a.winRate).slice(0, 100);

  res.status(200).json({ leaderboard });
});

app.get("/seed", async (_req: Request, res: Response) => {
  // await prisma.match.deleteMany();
  // await prisma.aIModel.deleteMany();

  const providers = [
    "OpenAI",
    "Anthropic",
    "Google",
    "Mistral",
    "Meta",
    "Cohere",
    "xAI",
  ];
  const moves = ["ROCK", "PAPER", "SCISSORS"];

  const aiModels = [];

  // for (let i = 0; i < 150; i++) {
  //   const provider = faker.helpers.arrayElement(providers);
  //   const major = faker.number.int({ min: 1, max: 4 });
  //   const minor = faker.number.int({ min: 0, max: 9 });
  //   aiModels.push({
  //     name: `${faker.hacker.adjective()}-${faker.hacker.noun()}-${faker.number.int(
  //       { min: 1, max: 99 }
  //     )}`
  //       .toLowerCase()
  //       .replace(/\s+/g, "-"),
  //     provider,
  //     version: `${major}.${minor}`,
  //   });
  // }

  // await prisma.aIModel.createMany({
  //   data: aiModels,
  // });

  const models = await prisma.aIModel.findMany();

  const addModels = [];

  function* getModels() {
    for (const model of models) {
      for (let i = 0; i < 10000; i++) {
        const opponent = faker.helpers.arrayElement(models);
        const moveA = faker.helpers.arrayElement(moves);
        const moveB = faker.helpers.arrayElement(moves);
  
        let winnerId: string;
        if (moveA === moveB) {
          winnerId = faker.helpers.arrayElement([
            model.id.toString(),
            opponent.id.toString(),
          ]);
        } else if (
          (moveA === "ROCK" && moveB === "SCISSORS") ||
          (moveA === "SCISSORS" && moveB === "PAPER") ||
          (moveA === "PAPER" && moveB === "ROCK")
        ) {
          winnerId = model.id.toString();
        } else {
          winnerId = opponent.id.toString();
        }
  
        yield {
          modelAId: model.id,
          modelBId: opponent.id,
          winnerId: parseInt(winnerId),
          playedAt: faker.date.recent({ days: 30 }),
          durationMs: faker.number.int({ min: 50, max: 5000 }),
          modelAMove: moveA,
          modelBMove: moveB,
          rawLog: {},
        };
      }
    }
  }

  console.log('Adding matches...', addModels.length);
  const batchSize = 5000;
  const batches = batch(getModels(), batchSize);

  let i = 0;
  for (const batch of batches) {
    console.log('Adding batch', i, 'total', i * batchSize);
    i++;
    await prisma.match.createMany({
      data: batch,
    });
  }

  const matches = await prisma.match.count();

  res.status(200).json({ message: "Seeded successfully", matches });
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});


function* batch<T>(array: Iterator<T>, batchSize: number): Iterable<T[]> {
  while(true) {
    const batch = [];
    for (let i = 0; i < batchSize; i++) {
      const item = array.next();
      if (item.done) {
        break;
      }
      batch.push(item.value);
    }
    yield batch;
    if (batch.length < batchSize) {
      break;
    }
  }
}