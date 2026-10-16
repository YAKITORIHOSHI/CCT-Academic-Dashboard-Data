import { after, before, beforeEach, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { ref, get, set, update, remove, query, orderByChild, equalTo, onValue, runTransaction } from 'firebase/database';
import assert from 'node:assert/strict';
import { buildModuleMutation } from '../functions/academicValidation.js';
import { firebaseCollectionRows, subscribeSafely } from '../src/services/firebaseSafety.js';

let env;
const computing = 'School of Computer Studies';
const business = 'School of Business';
const access = (uid, role, department = computing, status = 'Active') => ({ accountId: uid, role, department, status });
const record = (id, uid = 'head1', department = computing, status = 'Pending Dean Approval') => ({
  id, department, academicYear: 'AY 2026-2027', semester: '1st Semester', subjectCode: id.toUpperCase(), subjectTitle: 'CCT Computing',
  enrolledCount: 10, passedCount: 8, failedCount: 2, droppedCount: 0, incCount: 0, averageGrade: 1.75, passingRate: 80,
  encodedByUid: uid, encodedById: uid, encodedBy: 'CCT Head', modifiedByUid: uid, approvedBy: '', approvedByUid: '', approvedAt: '', reviewedByUid: '', reviewedBy: '', reviewedAt: '', reviewNote: '', status, revision: 1
});
const db = (uid) => uid ? env.authenticatedContext(uid).database() : env.unauthenticatedContext().database();
before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-cct-security', database: {
    host: '127.0.0.1', port: 19000, rules: await readFile(new URL('../database.rules.json', import.meta.url), 'utf8')
  } });
});
after(async () => env?.cleanup());
beforeEach(async () => {
  await env.clearDatabase();
  await env.withSecurityRulesDisabled(async (context) => set(ref(context.database()), {
    access: { admin: access('admin', 'VPAA'), head1: access('head1', 'Heads'), head2: access('head2', 'Heads'),
      dean: access('dean', 'Deans'), president: access('president', 'President', business), suspended: access('suspended', 'Heads', computing, 'Suspended') },
    accounts: { admin: { id: 'admin', uid: 'admin', role: 'VPAA', name: 'CCT Admin' }, head1: { id: 'head1', uid: 'head1', role: 'Heads', name: 'CCT Head' }, dean: { id: 'dean', uid: 'dean', role: 'Deans', name: 'CCT Dean' } },
    requests: { own: record('own'), other: record('other', 'head2'), foreign: record('foreign', 'head2', business),
      approved: { ...record('approved', 'head1', computing, 'Approved'), approvedByUid: 'dean' } },
    departments: { computing: { id: 'computing', name: computing } },
    auditLogs: { entry: { action: 'CCT Record Saved' } }
  }));
});
test('guests, unprovisioned users, and suspended members cannot read CCT data', async () => {
  for (const uid of [null, 'stranger', 'suspended']) for (const path of ['requests', 'requests/own', 'accounts', 'departments', 'auditLogs']) {
    await assertFails(get(ref(db(uid), path)));
  }
});

test('authorized reads of not-yet-created collections are empty; denied realtime reads stay errors', async () => {
  for (const path of ['students','annualReports','sections','retention','faculty','departmentHeads','achievements','topcit']) {
    const snapshot=await assertSucceeds(get(ref(db('admin'),path)));
    assert.equal(snapshot.exists(),false);
    assert.deepEqual(firebaseCollectionRows(snapshot.val()),[]);
  }
  let off;
  try {
    const outcome=await new Promise((resolve)=>{
      off=subscribeSafely(onValue,()=>ref(db('head1'),'students'),()=>resolve('unexpected-data'),error=>resolve(String(error.code).toLowerCase()));
    });
    assert.match(outcome,/permission/);
  } finally { off?.(); }
});

test('two VPAA devices submitting the same Academic Year commit exactly one annual report under production rules', async () => {
  const targets = [db('admin'),db('admin')].map((database)=>ref(database,'annualReports/AY_2026_2027'));
  const listeners = [];
  try {
    await Promise.all(targets.map((target)=>new Promise((resolve,reject)=>listeners.push(onValue(target,resolve,reject)))));
    const results = await Promise.all(targets.map((target,index)=>runTransaction(target,buildModuleMutation({
      id:'AY_2026_2027',academicYear:'AY 2026-2027',year1:10+index,year2:0,year3:0,year4:0,year5:0,total:10+index,
      createdByUid:'admin',modifiedByUid:'admin',updatedAt:new Date().toISOString(),notes:''
    }),{applyLocally:false})));
    assert.equal(results.filter(result=>result.committed).length,1);
    const saved = (await get(ref(db('admin'),'annualReports'))).val();
    assert.equal(Object.keys(saved).length,1);
    assert.equal(saved.AY_2026_2027.revision,1);
    assert.ok([10,11].includes(saved.AY_2026_2027.total));
  } finally { listeners.forEach(off=>off()); }
});
test('department reads require an authorized query and cannot leak other departments', async () => {
  await assertFails(get(ref(db('head1'), 'requests')));
  const rows = await assertSucceeds(get(query(ref(db('head1'), 'requests'), orderByChild('department'), equalTo(computing))));
  if (rows.hasChild('foreign')) throw new Error('Foreign department leaked.');
  await assertFails(get(query(ref(db('head1'), 'requests'), orderByChild('department'), equalTo(business))));
  await assertFails(get(ref(db('dean'), 'requests/foreign')));
  await assertSucceeds(get(ref(db('admin'), 'requests')));
});
test('presidents can read approved records only and cannot write', async () => {
  await assertFails(get(ref(db('president'), 'requests/own')));
  await assertSucceeds(get(query(ref(db('president'), 'requests'), orderByChild('status'), equalTo('Approved'))));
  await assertFails(set(ref(db('president'), 'requests/new'), record('new', 'president')));
});
test('members can read their own profile but cannot grant roles, provision users, or alter audit history', async () => {
  await assertSucceeds(get(ref(db('head1'), 'accounts/head1')));
  await assertFails(get(ref(db('head1'), 'accounts')));
  await assertFails(get(ref(db('head1'), 'accounts/admin')));
  await assertSucceeds(set(ref(db('head1'), 'accounts/head1/name'), 'Updated CCT Head'));
  await assertFails(set(ref(db('head1'), 'accounts/head1/name'), null));
  for (const uid of ['head1', 'admin']) {
    await assertFails(set(ref(db(uid), 'access/head1/role'), 'VPAA'));
    await assertFails(set(ref(db(uid), 'accounts/head1/role'), 'VPAA'));
    await assertFails(set(ref(db(uid), 'accounts/new'), { role: 'VPAA' }));
    await assertFails(set(ref(db(uid), 'auditLogs/forged'), { action: 'Fake Approval' }));
    await assertFails(remove(ref(db(uid), 'auditLogs/entry')));
  }
});
test('heads can create and revise only their own pending records', async () => {
  await assertSucceeds(set(ref(db('head1'), 'requests/new'), record('new')));
  await assertSucceeds(update(ref(db('head1'), 'requests/own'), { subjectTitle: 'Revised', revision: 2 }));
  await assertFails(update(ref(db('head1'), 'requests/other'), { subjectTitle: 'Attack', modifiedByUid: 'head1', revision: 2 }));
  await assertFails(update(ref(db('head1'), 'requests/approved'), { subjectTitle: 'Attack', revision: 2 }));
  await assertFails(set(ref(db('head1'), 'requests/forged'), record('forged', 'head2')));
});
test('forged approval, actor identity, ownership changes, and stale revisions are rejected', async () => {
  await assertFails(set(ref(db('head1'), 'requests/spoofed'), { ...record('spoofed'), encodedBy: 'CCT Admin' }));
  await assertFails(update(ref(db('head1'), 'requests/own'), { status: 'Approved', approvedByUid: 'head1', revision: 2 }));
  await assertFails(update(ref(db('dean'), 'requests/own'), { status: 'Approved', approvedByUid: 'admin', modifiedByUid: 'dean', revision: 2 }));
  await assertFails(update(ref(db('dean'), 'requests/own'), { modifiedByUid: 'head1', revision: 2 }));
  await assertFails(update(ref(db('dean'), 'requests/own'), { encodedByUid: 'dean', modifiedByUid: 'dean', revision: 2 }));
  await assertFails(update(ref(db('head1'), 'requests/own'), { subjectTitle: 'Stale', revision: 1 }));
  await assertSucceeds(update(ref(db('dean'), 'requests/own'), { status: 'Approved', approvedBy: 'CCT Dean', approvedByUid: 'dean', modifiedByUid: 'dean', revision: 2 }));
});
test('invalid counts, extra fields, and deletion of approved records are blocked', async () => {
  await assertFails(set(ref(db('head1'), 'requests/new'), { ...record('new'), passedCount: 12 }));
  await assertFails(set(ref(db('head1'), 'requests/new'), { ...record('new'), failedCount: 1.5 }));
  await assertFails(set(ref(db('head1'), 'requests/new'), { ...record('new'), secretRole: 'VPAA' }));
  await assertFails(remove(ref(db('dean'), 'requests/approved')));
  await assertSucceeds(remove(ref(db('head1'), 'requests/own')));
});
test('only the VPAA can maintain CCT catalog data', async () => {
  await assertFails(set(ref(db('head1'), 'departments/new'), { id: 'new', name: business }));
  await assertSucceeds(set(ref(db('admin'), 'departments/new'), { id: 'new', name: business }));
});
test('only the VPAA can take responsibility for an orphaned legacy record', async () => {
  const legacy = record('legacy'); delete legacy.encodedByUid;
  await env.withSecurityRulesDisabled(async (context) => set(ref(context.database(), 'requests/legacy'), legacy));
  await assertFails(update(ref(db('head1'), 'requests/legacy'), { encodedByUid: 'head1', revision: 2 }));
  await assertFails(update(ref(db('dean'), 'requests/legacy'), { encodedByUid: 'dean', modifiedByUid: 'dean', revision: 2 }));
  await assertSucceeds(update(ref(db('admin'), 'requests/legacy'), { encodedByUid: 'admin', modifiedByUid: 'admin', revision: 2 }));
});

const academicRow=(id,extra,uid='head1')=>({id,academicYear:'AY 2026-2027',department:computing,departmentId:'computing',createdByUid:uid,modifiedByUid:uid,updatedAt:'2026-10-14T00:00:00.000Z',revision:1,...extra});
test('one annual report per Academic Year is enforced even with different counts or timestamps',async()=>{
  const row={id:'AY_2026_2027',academicYear:'AY 2026-2027',year1:10,year2:12,year3:0,year4:0,year5:0,total:22,createdByUid:'admin',modifiedByUid:'admin',updatedAt:'2026-10-14',revision:1};
  await assertSucceeds(set(ref(db('admin'),'annualReports/AY_2026_2027'),row));
  await assertFails(set(ref(db('admin'),'annualReports/other_timestamp'),{...row,id:'other_timestamp',year1:20,total:32}));
  await assertFails(set(ref(db('head1'),'annualReports/AY_2026_2027'),row));
  await assertFails(update(ref(db('admin'),'annualReports/AY_2026_2027'),{total:999,revision:2}));
  await assertSucceeds(update(ref(db('admin'),'annualReports/AY_2026_2027'),{year1:20,total:32,revision:2}));
});
test('student records protect personal data and validate current subject ownership',async()=>{
  const row=academicRow('stu_2026-001',{studentNumber:'2026-001',name:'CCT Student',yearLevel:1,status:'Enrolled'});
  await assertSucceeds(set(ref(db('head1'),'students/stu_2026-001'),row));
  await assertFails(get(ref(db('president'),'students/stu_2026-001')));
  await assertFails(set(ref(db('head1'),'students/duplicate'),{...row,id:'duplicate'}));
  await assertFails(update(ref(db('head1'),'students/stu_2026-001'),{subjectIds:{foreign:true},revision:2}));
  await assertFails(update(ref(db('head1'),'students/stu_2026-001'),{birthday:'2005-01-01',revision:2}));
  await assertFails(remove(ref(db('admin'),'students/stu_2026-001')));
});
test('retention links sections by Academic Year and rejects invalid student references',async()=>{
  await env.withSecurityRulesDisabled(async(context)=>update(ref(context.database()),{
    'students/stu_2026-001':academicRow('stu_2026-001',{studentNumber:'2026-001',name:'CCT Student',yearLevel:1,status:'Enrolled'}),
    'sections/section1':academicRow('section1',{name:'CS-1A',yearLevel:1})
  }));
  const id='ret_stu_2026-001_AY_2026_2027';const row=academicRow(id,{studentId:'stu_2026-001',sectionId:'section1',movement:'Retained'});
  await assertSucceeds(set(ref(db('head1'),'retention/'+id),row));
  await assertFails(update(ref(db('head1'),'retention/'+id),{movement:'Transferee',revision:2}));
  await assertSucceeds(update(ref(db('head1'),'retention/'+id),{movement:'Transferee',destination:'CCT Business',revision:2}));
  await assertFails(set(ref(db('head1'),'retention/wrong_year'),{...row,id:'wrong_year',academicYear:'AY 2027-2028'}));
});
test('faculty assignments validate the school and cannot be granted by Heads',async()=>{
  const facultyId='fac_F001_AY_2026_2027';
  await assertSucceeds(set(ref(db('dean'),'faculty/'+facultyId),academicRow(facultyId,{staffNumber:'F001',name:'CCT Faculty',rating:4},'dean')));
  const assignment=academicRow('dept_computing',{facultyId},'dean');delete assignment.academicYear;
  await assertFails(set(ref(db('head1'),'departmentHeads/dept_computing'),{...assignment,createdByUid:'head1',modifiedByUid:'head1'}));
  await assertSucceeds(set(ref(db('dean'),'departmentHeads/dept_computing'),assignment));
  await assertFails(remove(ref(db('admin'),'faculty/'+facultyId)));
});
