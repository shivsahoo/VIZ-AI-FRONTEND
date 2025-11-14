export interface DatabaseMetadataEntry {
  id: string;
  name: string;
  type: string;
  schema?: string | null;
}

interface StoredDatabaseMetadata {
  fetchedAt: number;
  connections: DatabaseMetadataEntry[];
}

const STORAGE_PREFIX = "vizai-db-metadata:";
const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

const getStorageKey = (projectId: string) => `${STORAGE_PREFIX}${projectId}`;

export const loadDatabaseMetadata = (
  projectId: string,
  ttlMs: number = DEFAULT_TTL_MS
): DatabaseMetadataEntry[] | null => {
  if (!projectId) {
    return null;
  }

  try {
    const raw = sessionStorage.getItem(getStorageKey(projectId));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as StoredDatabaseMetadata | null;
    if (!parsed || !Array.isArray(parsed.connections)) {
      sessionStorage.removeItem(getStorageKey(projectId));
      return null;
    }

    if (ttlMs > 0 && Date.now() - parsed.fetchedAt > ttlMs) {
      sessionStorage.removeItem(getStorageKey(projectId));
      return null;
    }

    return parsed.connections;
  } catch (error) {
    console.warn("[DatabaseMetadata] Failed to parse cached metadata:", error);
    sessionStorage.removeItem(getStorageKey(projectId));
    return null;
  }
};

export const storeDatabaseMetadata = (
  projectId: string,
  connections: DatabaseMetadataEntry[]
): void => {
  if (!projectId || !Array.isArray(connections)) {
    return;
  }

  try {
    const payload: StoredDatabaseMetadata = {
      fetchedAt: Date.now(),
      connections,
    };
    sessionStorage.setItem(getStorageKey(projectId), JSON.stringify(payload));
  } catch (error) {
    console.warn("[DatabaseMetadata] Failed to store metadata:", error);
  }
};

export const clearDatabaseMetadata = (projectId: string): void => {
  if (!projectId) {
    return;
  }
  sessionStorage.removeItem(getStorageKey(projectId));
};

