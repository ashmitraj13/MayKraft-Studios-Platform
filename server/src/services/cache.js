// Tiny in-memory TTL cache. One instance is used for the manager dashboard.
class TTLCache {
  constructor(ttlMs) {
    this.ttlMs = ttlMs;
    this.store = new Map();
  }

  get(key) {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (Date.now() > hit.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key, value) {
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  clear() {
    this.store.clear();
  }
}

const dashboardCache = new TTLCache(30 * 1000);

// Mongoose plugin: any write to a model using it empties the dashboard cache.
function invalidatesDashboard(schema) {
  const clear = () => dashboardCache.clear();
  const docOps = ['save', 'deleteOne'];
  const queryOps = ['findOneAndUpdate', 'findOneAndDelete', 'updateOne', 'updateMany', 'deleteOne', 'deleteMany', 'replaceOne'];
  schema.post(docOps, { document: true, query: false }, clear);
  schema.post(queryOps, { document: false, query: true }, clear);
  schema.post('insertMany', clear);
}

module.exports = { TTLCache, dashboardCache, invalidatesDashboard };
