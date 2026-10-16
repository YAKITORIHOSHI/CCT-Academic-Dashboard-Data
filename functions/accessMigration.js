import { isSafeKey, ROLES } from './validation.js';

// mappings must already be matched to Auth users by the trusted migration runner.
export function applyVerifiedAccessMappings(current, mappings, directory = current.accounts) {
  const byAccountId = {};
  for (const [uid, access] of Object.entries(mappings)) {
    const profile = directory?.[access.accountId];
    if (!isSafeKey(uid) || !isSafeKey(access.accountId) || byAccountId[access.accountId]
      || !profile || !ROLES.includes(access.role) || profile.role !== access.role
      || profile.department !== access.department || !profile.department?.trim()
      || !['Active', 'Suspended'].includes(profile.status)
      || !['Active', 'Suspended'].includes(access.status)
      || (profile.status !== access.status && access.status !== 'Suspended')) {
      throw new Error('Invalid or ambiguous verified CCT access mapping.');
    }
    byAccountId[access.accountId] = uid;
  }
  const next = { ...current, access: { ...current.access, ...mappings }, accounts: { ...current.accounts } };
  for (const [uid, access] of Object.entries(mappings)) {
    next.accounts[access.accountId] = { ...next.accounts[access.accountId], uid, status: access.status };
  }
  for (const [id, record] of Object.entries(current.requests || {})) {
    let accountId = record.encodedById;
    if (!accountId && record.encodedByUid) {
      const candidates = Object.entries(directory).filter(([key, profile]) => byAccountId[key]
        && (profile.uid === record.encodedByUid || current.access?.[record.encodedByUid]?.accountId === key));
      if (candidates.length === 1) accountId = candidates[0][0];
    }
    if (!accountId && !record.encodedByUid) {
      const candidates = Object.entries(directory).filter(([key, profile]) => byAccountId[key]
        && profile.name === record.encodedBy && profile.department === record.department);
      if (candidates.length === 1) accountId = candidates[0][0];
    }
    const uid = byAccountId[accountId];
    const oldUid = record.encodedByUid;
    const ownsOldUid = oldUid && (current.accounts?.[accountId]?.uid === oldUid
      || current.access?.[oldUid]?.accountId === accountId);
    if (uid && uid !== oldUid && (!oldUid || ownsOldUid)) {
      if (next.requests === current.requests) next.requests = { ...current.requests };
      next.requests[id] = { ...record, encodedByUid: uid,
        revision: (Number.isSafeInteger(record.revision) && record.revision >= 0 ? record.revision : 0) + 1 };
    }
  }
  return next;
}
