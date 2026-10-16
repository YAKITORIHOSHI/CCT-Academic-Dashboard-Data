import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyVerifiedAccessMappings } from '../functions/accessMigration.js';

const profile = { email: 'dean@college.cct.edu', name: 'Dean', role: 'Deans', department: 'School', status: 'Active', uid: 'old_uid' };
const mapping = { accountId: 'dean', role: 'Deans', department: 'School', status: 'Active' };

test('verified UID replacement preserves data and history, repairs known owners, and advances stale revisions', () => {
  const original = {
    accounts: { dean: { ...profile } }, access: { old_uid: { ...mapping } },
    auditLogs: { event: { uid: 'old_uid' } }, subjects: { subject: { title: 'Unchanged' } },
    requests: {
      known: { encodedById: 'dean', encodedByUid: 'old_uid', revision: 3 },
      uidOnly: { encodedByUid: 'old_uid', revision: 4 },
      legacy: { encodedBy: 'Dean', department: 'School' },
      unrelated: { encodedById: 'dean', encodedByUid: 'someone_else', revision: 2 }
    }
  };
  const before = structuredClone(original);
  const result = applyVerifiedAccessMappings(original, { new_uid: mapping });
  assert.deepEqual(original, before);
  assert.equal(result.accounts.dean.uid, 'new_uid');
  assert.deepEqual(result.access.old_uid, mapping);
  assert.deepEqual(result.access.new_uid, mapping);
  assert.equal(result.requests.known.encodedByUid, 'new_uid');
  assert.equal(result.requests.known.revision, 4);
  assert.equal(result.requests.uidOnly.encodedByUid, 'new_uid');
  assert.equal(result.requests.uidOnly.revision, 5);
  assert.equal(result.requests.legacy.encodedByUid, 'new_uid');
  assert.equal(result.requests.legacy.revision, 1);
  assert.deepEqual(result.requests.unrelated, before.requests.unrelated);
  assert.deepEqual(result.auditLogs, before.auditLogs);
  assert.deepEqual(result.subjects, before.subjects);
  assert.deepEqual(applyVerifiedAccessMappings(result, { new_uid: mapping }), result);
});

test('migration rejects role expansion, invalid profiles, duplicate identities, and reactivation of suspended accounts', () => {
  const current = { accounts: { dean: profile } };
  for (const change of [{ role: 'VPAA' }, { department: 'Other School' }, { accountId: 'missing' }]) {
    assert.throws(() => applyVerifiedAccessMappings(current, { new_uid: { ...mapping, ...change } }));
  }
  assert.throws(() => applyVerifiedAccessMappings(current, { first: mapping, second: mapping }));
  assert.throws(() => applyVerifiedAccessMappings({ accounts: { dean: { ...profile, status: 'Suspended' } } }, { new_uid: mapping }));
  assert.throws(() => applyVerifiedAccessMappings({ accounts: { dean: { ...profile, status: undefined } } }, { new_uid: { ...mapping, status: 'Suspended' } }));
  const disabled = applyVerifiedAccessMappings(current, { new_uid: { ...mapping, status: 'Suspended' } });
  assert.equal(disabled.accounts.dean.status, 'Suspended');
  assert.equal(disabled.access.new_uid.status, 'Suspended');
  assert.equal(Object.hasOwn(disabled, 'requests'), false);
});

test('ambiguous legacy owner names never assign records to an arbitrary account', () => {
  const current = { accounts: { first: profile, second: { ...profile, uid: 'other_uid' } },
    requests: { record: { encodedBy: 'Dean', department: 'School' } } };
  const result = applyVerifiedAccessMappings(current, {
    first_uid: { ...mapping, accountId: 'first' }, second_uid: { ...mapping, accountId: 'second' }
  });
  assert.deepEqual(result.requests, current.requests);
});
