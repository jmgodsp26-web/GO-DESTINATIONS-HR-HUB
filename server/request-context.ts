import { AsyncLocalStorage } from 'node:async_hooks';
import type { HRDatabase } from './db.js';
const context = new AsyncLocalStorage<HRDatabase>();
export function currentDatabase(): HRDatabase {
  const db = context.getStore();
  if (!db) throw new Error('Database access outside a transaction.');
  return db;
}
export function withDatabase<T>(db: HRDatabase, operation: () => T): T {
  return context.run(db, operation);
}
