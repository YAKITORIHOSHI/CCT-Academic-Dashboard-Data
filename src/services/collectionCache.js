// The cache is a short-lived rendering aid. Firebase remains the source of truth.
export const CACHE_VERSION = 1;
export const CACHE_TTL_MS = 15 * 60 * 1000;
const MAX_BYTES = 1_500_000;

export const createCacheScope = (projectId, uid, role, department) => (
  uid ? [projectId, uid, role, department].map((value) => encodeURIComponent(value || '')).join(':') : ''
);

export const pruneCollectionCache = (storage, projectId, scope = '') => {
  const projectPrefix = `cct:collections:v${CACHE_VERSION}:${encodeURIComponent(projectId)}:`;
  const activePrefix = scope ? `cct:collections:v${CACHE_VERSION}:${scope}:` : '';
  try {
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index);
      if (key?.startsWith(projectPrefix) && (!activePrefix || !key.startsWith(activePrefix))) storage.removeItem(key);
    }
  } catch { /* Browsers can disable optional storage. */ }
};

export const createCollectionCache = ({ storage, scope, now = Date.now, schedule, cancel }) => {
  const prefix = `cct:collections:v${CACHE_VERSION}:${scope}:`;
  const pending = new Map();
  let timer;
  let disposed = false;
  const key = (collection) => `${prefix}${collection}`;
  const flush = () => {
    timer = undefined;
    if (disposed || !scope) return;
    for (const [collection, value] of pending) {
      try {
        const serialized = JSON.stringify({ version: CACHE_VERSION, savedAt: now(), value });
        if (serialized.length * 2 <= MAX_BYTES) storage?.setItem(key(collection), serialized);
        else storage?.removeItem(key(collection));
      } catch { /* Storage quotas/private mode never interrupt the workspace. */ }
    }
    pending.clear();
  };
  return {
    read(collection, fallback = []) {
      if (disposed || !scope) return fallback;
      try {
        const entry = JSON.parse(storage?.getItem(key(collection)) || 'null');
        if (entry?.version !== CACHE_VERSION || !Array.isArray(entry.value)
          || !Number.isFinite(entry.savedAt) || entry.savedAt > now()
          || now() - entry.savedAt > CACHE_TTL_MS) {
          storage?.removeItem(key(collection));
          return fallback;
        }
        return entry.value;
      } catch { return fallback; }
    },
    write(collection, value) {
      if (disposed || !scope) return;
      pending.set(collection, value);
      if (timer === undefined) timer = schedule(flush);
    },
    dispose({ clear = false } = {}) {
      disposed = true;
      if (timer !== undefined) cancel(timer);
      timer = undefined;
      pending.clear();
      if (clear) {
        try {
          for (let index = storage.length - 1; index >= 0; index -= 1) {
            const storedKey = storage.key(index);
            if (storedKey?.startsWith(prefix)) storage.removeItem(storedKey);
          }
        } catch { /* Best effort cleanup in browsers that disable storage. */ }
      }
    }
  };
};

export const removeLegacyCollectionCache = (storage, projectId) => {
  try {
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index);
      const projectCache = key?.startsWith(`cct:collections:v1:${encodeURIComponent(projectId)}:`);
      if (projectCache || (key?.startsWith(`${projectId}:cct_`) && key !== `${projectId}:cct_keep_signed_in`)) storage.removeItem(key);
    }
  } catch { /* Optional cache migration. */ }
};
