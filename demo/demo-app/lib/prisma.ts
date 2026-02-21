import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";

const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
await adapter.connect();
const prisma = new PrismaClient({ adapter });
await prisma.$connect();

export { prisma };
