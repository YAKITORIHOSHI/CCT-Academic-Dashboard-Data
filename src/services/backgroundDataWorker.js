let worker;
let nextRequestId = 0;
const pending = new Map();

const getWorker = () => {
  if (typeof Worker === 'undefined') return null;
  if (worker) return worker;

  try {
    worker = new Worker(new URL('../workers/dataNormalizer.worker.js', import.meta.url), { type: 'module' });
  } catch { return null; }
  worker.onmessage = (event) => {
    const { requestId, success, result, error } = event.data || {};
    const request = pending.get(requestId);
    if (!request) return;
    pending.delete(requestId);
    clearTimeout(request.timer);
    if (success) request.resolve(result);
    else request.reject(new Error(error || 'Background data normalization failed.'));
  };
  worker.onerror = (error) => {
    pending.forEach(({ reject, timer }) => { clearTimeout(timer); reject(error); });
    pending.clear();
    worker?.terminate();
    worker = null;
  };
  return worker;
};

export const normalizeSnapshotInBackground = (collection, value, fallback) => {
  const activeWorker = getWorker();
  if (!activeWorker) return Promise.resolve().then(() => fallback(value));

  const requestId = ++nextRequestId;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(requestId);
      reject(new Error('Background normalization timed out.'));
    }, 10000);
    pending.set(requestId, { resolve, reject, timer });
    try {
      activeWorker.postMessage({ requestId, collection, value });
    } catch (error) {
      pending.delete(requestId);
      clearTimeout(timer);
      reject(error);
    }
  }).catch(() => fallback(value));
};
