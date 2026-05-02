import { neon, NeonQueryFunction } from "@neondatabase/serverless";
import { drizzle, NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

let _db: NeonHttpDatabase<typeof schema> | null = null;
let _sql: NeonQueryFunction<false, false> | null = null;

function init() {
  if (_db && _sql) return { db: _db, sql: _sql };
  const url = process.env.POSTGRES_URL;
  if (!url) throw new Error("POSTGRES_URL is not set");
  _sql = neon(url);
  _db = drizzle(_sql, { schema });
  return { db: _db, sql: _sql };
}

export const db = new Proxy({} as NeonHttpDatabase<typeof schema>, {
  get(_t, p) {
    return Reflect.get(init().db, p);
  },
});
