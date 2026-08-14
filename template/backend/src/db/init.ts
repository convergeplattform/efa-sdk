import fs from 'fs';
import path from 'path';
import { applySchema, isSqlite } from '../db';

export async function initDb(): Promise<void> {
  // Pro Treiber eigenes Schema-File: Postgres-Dialekt (UUID, JSONB, NOW()) vs.
  // SQLite-Dialekt (TEXT-IDs, CURRENT_TIMESTAMP). Beide werden vom Dockerfile
  // neben den kompilierten Code kopiert.
  const schemaFile = isSqlite ? 'schema.sqlite.sql' : 'schema.sql';
  const schemaPath = path.join(__dirname, schemaFile);
  const schema = fs.readFileSync(schemaPath, 'utf8');
  await applySchema(schema);
  console.log(
    JSON.stringify({ level: 'info', msg: 'Database schema initialized', driver: isSqlite ? 'sqlite' : 'postgres' }),
  );
}
