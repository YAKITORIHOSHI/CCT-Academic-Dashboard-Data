import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

if (!process.env.FIREBASE_AUTH_EMULATOR_HOST || !process.env.FIREBASE_DATABASE_EMULATOR_HOST) throw new Error('CCT server tests require the local emulators.');
process.env.GCLOUD_PROJECT = 'demo-cct-security';
process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: 'demo-cct-security', databaseURL: 'https://demo-cct-security.firebaseio.com' });
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const { getAuth } = require('firebase-admin/auth');
const { getDatabase } = require('firebase-admin/database');
const { getApp } = require('firebase-admin/app');
const { manageCctAccount, restoreCctSnapshot } = await import('../functions/index.js');
const { withCctErrorHandling } = await import('../functions/firebaseErrors.js');
const request = (uid = 'admin', data = {}, age = 0) => ({ auth: { uid, token: { auth_time: Math.floor(Date.now() / 1000) - age } }, data });
before(async () => {
  for (const uid of ['admin', 'head']) await getAuth().createUser({ uid, email: `${uid}@college.cct.edu` });
});
beforeEach(async () => {
  await getAuth().updateUser('admin', { disabled: false });
  await getDatabase().ref().set({
    access: { admin: { accountId: 'admin', role: 'VPAA', department: 'Office of VPAA', status: 'Active' }, head: { accountId: 'head', role: 'Heads', department: 'CCT Computing', status: 'Active' } },
    accounts: { admin: { id: 'admin', uid: 'admin', name: 'CCT Admin', email: 'admin@college.cct.edu', role: 'VPAA', department: 'Office of VPAA', status: 'Active' },
      head: { id: 'head', uid: 'head', name: 'CCT Head', email: 'head@college.cct.edu', role: 'Heads', department: 'CCT Computing', status: 'Active' } },
    departments: { computing: { id: 'computing', name: 'CCT Computing' } },
    auditLogs: { preserved: { action: 'Existing CCT Audit' } }
  });
});
after(async () => getApp().delete());
test('privileged CCT endpoints reject unauthenticated, non-admin, and stale sessions', async () => {
  await assert.rejects(manageCctAccount.run({ data: {} }), { code: 'unauthenticated' });
  await assert.rejects(manageCctAccount.run(request('head')), { code: 'permission-denied' });
  await assert.rejects(restoreCctSnapshot.run(request('head', { rawJson: '{}' })), { code: 'permission-denied' });
  await assert.rejects(manageCctAccount.run(request('admin', {}, 1000)), { code: 'failed-precondition' });
});

test('missing administrator Auth users and directory accounts produce controlled errors', async () => {
  await assert.rejects(manageCctAccount.run(request('not-created')),{code:'permission-denied'});
  await assert.rejects(manageCctAccount.run(request('admin',{action:'status',id:'not-created',status:'Active'})),{code:'failed-precondition'});
  const orphan={id:'vanished',uid:'vanished',name:'CCT Legacy Member',role:'Heads',department:'CCT Computing',status:'Active'};
  await getDatabase().ref('accounts/vanished').set(orphan);
  await assert.rejects(manageCctAccount.run(request('admin',{action:'status',id:'vanished',status:'Suspended'})),{code:'failed-precondition'});
  assert.equal((await getDatabase().ref('accounts/vanished/status').get()).val(),'Active');
  assert.equal((await getDatabase().ref('access/vanished').get()).exists(),false);
});

test('server connectivity errors remain unavailable, and incomplete action counters recover safely', async () => {
  const failing=withCctErrorHandling('test connection',async()=>{throw Object.assign(new Error('Unavailable'),{code:'app/network-error'});});
  await assert.rejects(failing({}),{code:'unavailable'});
  await getDatabase().ref('securityRateLimits/admin').set({startedAt:Date.now()});
  await assert.rejects(manageCctAccount.run(request('admin',{action:'status',id:'not-created',status:'Active'})),{code:'failed-precondition'});
  assert.equal((await getDatabase().ref('securityRateLimits/admin/count').get()).val(),1);
});
test('server provisioning binds profiles and access to the actual Auth UID and never stores passwords', async () => {
  const result = await manageCctAccount.run(request('admin', { action: 'create', profile: {
    name: 'New CCT Head', email: 'new-head@college.cct.edu', password: 'Strong-Cct-Password-26', role: 'Heads', department: 'CCT Computing'
  } }));
  const user = await getAuth().getUserByEmail('new-head@college.cct.edu');
  assert.equal(result.account.uid, user.uid);
  assert.equal((await getDatabase().ref(`access/${user.uid}/accountId`).get()).val(), user.uid);
  assert.equal(Object.hasOwn((await getDatabase().ref(`accounts/${user.uid}`).get()).val(), 'password'), false);
});
test('invalid passwords and unknown departments are rejected before creating Auth users', async () => {
  const profile = { name: 'Rejected CCT User', email: 'rejected@college.cct.edu', password: 'weak', role: 'Heads', department: 'CCT Computing' };
  await assert.rejects(manageCctAccount.run(request('admin', { action: 'create', profile })), { code: 'invalid-argument' });
  await assert.rejects(manageCctAccount.run(request('admin', { action: 'create', profile: { ...profile, password: 'Strong-Cct-Password-26', department: 'Unknown' } })), { code: 'invalid-argument' });
  await assert.rejects(getAuth().getUserByEmail(profile.email), { code: 'auth/user-not-found' });
});
test('VPAA cannot revoke their own administrative access; suspension blocks the target immediately', async () => {
  await assert.rejects(manageCctAccount.run(request('admin', { action: 'status', id: 'admin', status: 'Suspended' })), { code: 'failed-precondition' });
  await manageCctAccount.run(request('admin', { action: 'status', id: 'head', status: 'Suspended' }));
  assert.equal((await getDatabase().ref('access/head/status').get()).val(), 'Suspended');
  assert.equal((await getAuth().getUser('head')).disabled, true);
});
test('server restore preserves privileged profiles, access, and existing audit history', async () => {
  await restoreCctSnapshot.run(request('admin', { rawJson: JSON.stringify({
    departments: [{ id: 'restored', name: 'CCT Restored Department' }], accounts: [], access: { head: { role: 'VPAA' } }, auditLogs: []
  }) }));
  assert.equal((await getDatabase().ref('access/head/role').get()).val(), 'Heads');
  assert.equal((await getDatabase().ref('accounts/admin/name').get()).val(), 'CCT Admin');
  assert.equal((await getDatabase().ref('auditLogs/preserved/action').get()).val(), 'Existing CCT Audit');
});

test('server restore preserves new academic collections and rejects broken links atomically', async () => {
  const annual = {id:'AY_2026_2027',academicYear:'AY 2026-2027',year1:3,year2:2,year3:1,year4:0,year5:0,total:6,createdByUid:'admin',modifiedByUid:'admin',revision:7};
  await restoreCctSnapshot.run(request('admin',{rawJson:JSON.stringify({annualReports:[annual]})}));
  assert.equal((await getDatabase().ref('annualReports/AY_2026_2027/total').get()).val(),6);
  assert.equal((await getDatabase().ref('annualReports/AY_2026_2027/revision').get()).val(),1);
  const student = {id:'stu_TEST',studentNumber:'TEST',name:'CCT Test Student',department:'CCT Computing',departmentId:'computing',academicYear:'AY 2026-2027',yearLevel:1,status:'Enrolled',programId:'',subjectIds:{missing:true},notes:'',createdByUid:'admin',modifiedByUid:'admin'};
  await assert.rejects(restoreCctSnapshot.run(request('admin',{rawJson:JSON.stringify({students:[student],annualReports:[{...annual,year1:100}]})})),{code:'invalid-argument'});
  assert.equal((await getDatabase().ref('students').get()).exists(),false);
  assert.equal((await getDatabase().ref('annualReports/AY_2026_2027/total').get()).val(),6);
});
