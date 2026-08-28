import * as SQLite from 'expo-sqlite';

export type CacheFallback<T> = {
  cachedAt: string;
  data: T;
};

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDatabase() {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync('clutch-offline-cache.db').then(
      async (database) => {
        await database.execAsync(`
          create table if not exists offline_cache (
            cache_key text primary key not null,
            payload text not null,
            updated_at text not null
          );
        `);

        return database;
      },
    );
  }

  return databasePromise;
}

export async function writeCache<T>(cacheKey: string, data: T) {
  const database = await getDatabase();
  const updatedAt = new Date().toISOString();

  await database.runAsync(
    `
      insert into offline_cache (cache_key, payload, updated_at)
      values (?, ?, ?)
      on conflict(cache_key) do update set
        payload = excluded.payload,
        updated_at = excluded.updated_at;
    `,
    [cacheKey, JSON.stringify(data), updatedAt],
  );

  return updatedAt;
}

export async function updateCachedListItem<T extends { id: string }>(
  cacheKey: string,
  item: T,
) {
  const cachedValue = await readCache<T[]>(cacheKey);
  const currentItems = cachedValue?.data ?? [];
  const nextItems = currentItems.some((currentItem) => currentItem.id === item.id)
    ? currentItems.map((currentItem) =>
        currentItem.id === item.id ? item : currentItem,
      )
    : [item, ...currentItems];

  await writeCache(cacheKey, nextItems);
}

export async function readCache<T>(
  cacheKey: string,
): Promise<CacheFallback<T> | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{
    payload: string;
    updated_at: string;
  }>(
    'select payload, updated_at from offline_cache where cache_key = ? limit 1;',
    [cacheKey],
  );

  if (!row) {
    return null;
  }

  return {
    cachedAt: row.updated_at,
    data: JSON.parse(row.payload) as T,
  };
}

export async function fetchWithCache<T>({
  cacheKey,
  fetcher,
  onCacheFallback,
  onNetworkSuccess,
}: {
  cacheKey: string;
  fetcher: () => Promise<T>;
  onCacheFallback?: (cachedAt: string) => void;
  onNetworkSuccess?: () => void;
}) {
  try {
    const data = await fetcher();
    await writeCache(cacheKey, data);
    onNetworkSuccess?.();
    return data;
  } catch (error) {
    if (!isLikelyNetworkError(error)) {
      throw error;
    }

    const cachedValue = await readCache<T>(cacheKey);

    if (cachedValue) {
      onCacheFallback?.(cachedValue.cachedAt);
      return cachedValue.data;
    }

    throw error;
  }
}

export function makeTeamCacheKey(
  scope: 'players' | 'games' | 'drills',
  teamId: string,
) {
  return `${scope}:team:${teamId}`;
}

export function makeLineupCacheKey(gameId: string) {
  return `lineup:game:${gameId}`;
}

export function isLikelyNetworkError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const message =
    'message' in error && typeof error.message === 'string'
      ? error.message.toLowerCase()
      : '';

  return (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('connection') ||
    message.includes('offline') ||
    message.includes('timeout')
  );
}
