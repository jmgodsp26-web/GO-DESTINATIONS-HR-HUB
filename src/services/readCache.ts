// Private, bounded memory only. Never persist HR responses or session credentials.
export function createReadCache(now = () => Date.now()) {
  let generation = 0;
  let identity = 0;
  const values = new Map<string, { value: unknown; expires: number }>();
  const pending = new Map<string, Promise<unknown>>();
  return {
    clear() { generation++; values.clear(); pending.clear(); },
    reset() { identity++; generation++; values.clear(); pending.clear(); },
    async read<T>(key: string, load: () => Promise<T>, ttl = 0): Promise<T> {
      const cached = values.get(key);
      if (cached && cached.expires > now()) return structuredClone(cached.value) as T;
      values.delete(key);
      let promise = pending.get(key);
      if (!promise) {
        const version = generation;
        const owner = identity;
        promise = load().then(value => {
          if (identity !== owner) throw new Error('Your sign-in changed while loading. Please refresh this page.');
          if (ttl > 0 && generation === version) {
            if (values.size >= 20) values.delete(values.keys().next().value!);
            values.set(key, { value: structuredClone(value), expires: now() + ttl });
          }
          return value;
        });
        pending.set(key, promise);
      }
      try { return structuredClone(await promise) as T; }
      finally { if (pending.get(key) === promise) pending.delete(key); }
    },
  };
}
