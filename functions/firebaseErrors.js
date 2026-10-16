import { HttpsError } from 'firebase-functions/v2/https';

export const withCctErrorHandling = (action, handler) => async (request) => {
  try { return await handler(request); }
  catch (error) {
    if (error instanceof HttpsError) throw error;
    const code = String(error?.code || '').toLowerCase();
    console.error('CCT Firebase server operation failed.', { action, code: code || 'unknown' });
    if (code === 'auth/user-not-found' || code === 'auth/user-disabled') throw new HttpsError('permission-denied', 'A verified, active CCT administrator account is required.');
    if (code.includes('network') || code.includes('unavailable') || code.includes('disconnected') || ['etimedout','econnreset','enotfound'].includes(code)) {
      throw new HttpsError('unavailable', 'CCT Firebase could not complete this request. Refresh the current data before trying again.');
    }
    throw new HttpsError('internal', 'The CCT service could not complete this request. Refresh the current data or contact the CCT administrator.');
  }
};
