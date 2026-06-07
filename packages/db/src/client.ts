import { drizzle } from "drizzle-orm/node-postgres";

import * as schema from "./schema";

export function createDb(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to create a database client.");
  }

  return drizzle(databaseUrl, { schema });
}

export type DbClient = ReturnType<typeof createDb>;
