import "server-only";
import neo4j, { type Driver } from "neo4j-driver";

declare global {
  var neo4jDriver: Driver | null | undefined;
}

function getNeo4jDriver(): Driver | null {
  if (global.neo4jDriver !== undefined) {
    return global.neo4jDriver;
  }

  const uri = process.env.NEO4J_URI;
  const username = process.env.NEO4J_USERNAME;
  const password = process.env.NEO4J_PASSWORD;

  if (!uri || !username || !password) {
    global.neo4jDriver = null;
    return null;
  }

  const driver = neo4j.driver(uri, neo4j.auth.basic(username, password));

  global.neo4jDriver = driver;
  return driver;
}

export async function getNeo4jStatus(): Promise<{
  ok: boolean;
  message: string;
}> {
  const driver = getNeo4jDriver();

  if (!driver) {
    return {
      ok: false,
      message:
        "Missing Neo4j config. Set NEO4J_URI, NEO4J_USERNAME and NEO4J_PASSWORD.",
    };
  }

  try {
    await driver.verifyConnectivity();

    const session = driver.session({ defaultAccessMode: neo4j.session.READ });
    try {
      const result = await session.run("RETURN 'connected' AS status");
      const status = result.records[0]?.get("status");

      return {
        ok: true,
        message: String(status ?? "connected"),
      };
    } finally {
      await session.close();
    }
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to connect to Neo4j.",
    };
  }
}
