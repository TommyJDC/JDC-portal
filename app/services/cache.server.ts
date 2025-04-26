interface CacheEntry {
  data: any;
  expires: number;
}

const cache = new Map<string, CacheEntry>();

export async function getCache(key: string): Promise<any | null> {
  const entry = cache.get(key);
  if (!entry) return null;
  
  if (Date.now() > entry.expires) {
    cache.delete(key);
    return null;
  }
  
  return entry.data;
}

export async function setCache(key: string, data: any, ttlSeconds = 5): Promise<void> {
  cache.set(key, {
    data,
    expires: Date.now() + ttlSeconds * 1000
  });
}
