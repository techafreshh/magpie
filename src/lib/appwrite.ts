import { Client, Query, VectorsDB } from 'appwrite';
import type { Models } from 'appwrite';

// Fixed repo vocabulary (PRD): one VectorsDB database `magpie` → collection `reports`.
export const DATABASE_ID = 'magpie';
export const COLLECTION_ID = 'reports';

export interface AppwriteHealth {
  /** Env vars present? */
  configured: boolean;
  /** Could a real listDocuments call reach the database? */
  ok: boolean;
  /** Human-readable one-liner about the last check. */
  detail: string;
}

export function readConfig(): { endpoint: string; projectId: string } | null {
  const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT;
  const projectId = import.meta.env.VITE_APPWRITE_PROJECT_ID;
  if (!endpoint || !projectId) return null;
  return { endpoint, projectId };
}

export async function checkAppwrite(): Promise<AppwriteHealth> {
  const config = readConfig();
  if (!config) {
    return {
      configured: false,
      ok: false,
      detail: 'VITE_APPWRITE_ENDPOINT / VITE_APPWRITE_PROJECT_ID are not set (see .env.example)',
    };
  }

  try {
    const client = new Client().setEndpoint(config.endpoint).setProject(config.projectId);
    const vectors = new VectorsDB(client);
    const list: Models.DocumentList<Models.DefaultDocument> = await vectors.listDocuments({
      databaseId: DATABASE_ID,
      collectionId: COLLECTION_ID,
      queries: [Query.limit(1)],
    });
    return {
      configured: true,
      ok: true,
      detail: `database "${DATABASE_ID}" answered — ${list.total} report(s) on file`,
    };
  } catch (err) {
    // Any failure (missing database, CORS, auth, network) degrades gracefully to unreachable.
    return { configured: true, ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}
