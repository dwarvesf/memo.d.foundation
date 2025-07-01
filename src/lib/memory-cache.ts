class MemoryCache<K, V> {
  private cache = new Map();

  set(key: K, value: V, ttl?: number): void {
    const expiresAt = ttl && ttl > 0 ? Date.now() + ttl : null;
    this.cache.set(key, { value, expiresAt });
  }

  get<V>(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt !== null && entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value as V;
  }

  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: K): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  // Optional: clean up expired entries
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt !== null && entry.expiresAt < now) {
        this.cache.delete(key);
      }
    }
  }
}

const memoryCache = new MemoryCache();

export { memoryCache };
