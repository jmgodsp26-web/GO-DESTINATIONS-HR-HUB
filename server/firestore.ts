import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import fs from 'node:fs';
import path from 'node:path';

let dbInstance: Firestore | null = null;
export function getFirebaseConfig() {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  return fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf8')) : null;
}
export function getFirestoreDb(): Firestore | null {
  if (process.env.FIRESTORE_DISABLED === 'true') return null;
  if (dbInstance) return dbInstance;
  const config = getFirebaseConfig();
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || config?.projectId;
  if (!projectId) return null;
  const app = getApps()[0] || initializeApp({ credential: applicationDefault(), projectId });
  dbInstance = getFirestore(app, config?.firestoreDatabaseId || '(default)');
  return dbInstance;
}
export async function testFirestoreConnection(): Promise<boolean> {
  const db = getFirestoreDb();
  if (!db) return false;
  try { await db.doc('_connection_test/health').get(); return true; }
  catch { return false; }
}
