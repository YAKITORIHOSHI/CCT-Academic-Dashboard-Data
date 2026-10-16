import { ref, onValue, runTransaction } from 'firebase/database';
import { buildRecordMutation } from '../utils/recordConcurrency.js';
import { withFirebaseReadDeadline } from './firebaseSafety.js';

export const runRecordTransaction = async (database, path, options, isCurrentSession = () => true) => {
  const reference = ref(database, path);
  let unsubscribe;
  try {
    // A get() alone does not keep the SDK's transaction cache populated.
    // Keep a row listener alive through the commit, including on a cold device.
    await withFirebaseReadDeadline(() => new Promise((resolve, reject) => {
      unsubscribe = onValue(reference, () => resolve(), reject);
    }));
    const mutate = buildRecordMutation(options);
    return await runTransaction(reference, (current) => isCurrentSession() ? mutate(current) : undefined, { applyLocally: false });
  } finally { unsubscribe?.(); }
};
