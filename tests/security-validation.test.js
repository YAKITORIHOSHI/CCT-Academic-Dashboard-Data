import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSafeKey, validateAccount, validateSnapshot, validateAcademicReferences } from '../functions/validation.js';
import { validateModule, moduleIdentity } from '../functions/academicValidation.js';
import { csvCell } from '../src/utils/csv.js';

test('CCT CSV exports neutralize spreadsheet formulas and preserve ordinary data', () => {
  for (const value of ['=HYPERLINK("https://example.com")', ' +cmd', '\t@SUM(1,1)', '-2+3']) assert.ok(csvCell(value).startsWith('"\''));
  assert.equal(csvCell('CCT "Computing"'), '"CCT ""Computing"""');
  assert.equal(csvCell(90), '"90"');
});

test('account provisioning requires a strong password and an approved CCT role', () => {
  const profile = { name: 'CCT Head', role: 'Heads', department: 'School of Computer Studies', email: 'head@college.cct.edu', password: 'Cct-Test-Password-15' };
  assert.equal(validateAccount(profile, true).role, 'Heads');
  for (const password of ['123456', 'aaaaaaaaaaaaa', 'CctTestPassword', 'A1!short']) assert.throws(() => validateAccount({ ...profile, password }, true));
  assert.throws(() => validateAccount({ ...profile, role: 'Owner' }, true));
  assert.throws(() => validateAccount({ ...profile, email: 'outside@example.com' }, true));
});
test('snapshot imports cannot grant access or rewrite accounts and audit history', () => {
  const result = validateSnapshot(JSON.stringify({ accounts: [{ id: 'attacker', role: 'VPAA' }], access: { attacker: { role: 'VPAA' } }, auditLogs: [], departments: [{ id: 'dept1', name: 'CCT Computing' }] }));
  assert.deepEqual(Object.keys(result), ['departments']);
  assert.equal(result.departments.dept1.name, 'CCT Computing');
});
test('restore rejects unsafe keys, path injection, duplicate IDs, and oversized files', () => {
  assert.equal(isSafeKey('../access'), false);
  assert.equal(isSafeKey('__proto__'), false);
  assert.throws(() => validateSnapshot('{"departments":{"__proto__":{"name":"attack"}}}'));
  assert.throws(() => validateSnapshot(JSON.stringify({ departments: [{ id: 'access/uid', name: 'attack' }] })));
  assert.throws(() => validateSnapshot(JSON.stringify({ departments: [{ id: 'same', name: 'A' }, { id: 'same', name: 'B' }] })));
  assert.throws(() => validateSnapshot(' '.repeat(10 * 1024 * 1024 + 1)));
});
test('restore rejects invalid student outcomes and missing authoritative ownership', () => {
  const row = { id: 'rec1', department: 'CCT Computing', academicYear: 'AY 2026-2027', semester: '1st Semester', subjectCode: 'CS1', subjectTitle: 'Computing', status: 'Approved', enrolledCount: 10, passedCount: 8, failedCount: 2, droppedCount: 0, incCount: 0, averageGrade: 1.75, encodedByUid: 'head1' };
  assert.equal(validateSnapshot(JSON.stringify({ records: [row] })).requests.rec1.subjectCode, 'CS1');
  assert.throws(() => validateSnapshot(JSON.stringify({ records: [{ ...row, passedCount: 20 }] })));
  assert.throws(() => validateSnapshot(JSON.stringify({ records: [{ ...row, encodedByUid: undefined }] })));
});

test('academic snapshots preserve validated annual counts and reject noncanonical duplicate years', () => {
  const row = { ...validateModule('annualReports', { academicYear:'2026-2027', year1:10, year2:8, year3:7, year4:6, year5:0 }),
    id:'AY_2026_2027', createdByUid:'admin', modifiedByUid:'admin', revision:2 };
  const result = validateSnapshot(JSON.stringify({ annualReports:[row] }));
  assert.equal(result.annualReports.AY_2026_2027.total,31);
  assert.throws(() => validateSnapshot(JSON.stringify({ annualReports:[row, {...row,id:'timestamp_2'}] })));
  assert.throws(() => validateSnapshot(JSON.stringify({ annualReports:[{...row,password:'unsupported'}] })));
  assert.throws(() => validateSnapshot(JSON.stringify({ annualReports:[{...row,id:'timestamp_1'}] })));
});

test('explicitly absent snapshot collections are empty without removing unspecified collections', () => {
  const result=validateSnapshot(JSON.stringify({records:null,students:null,annualReports:null}));
  assert.deepEqual(result,{requests:{},students:{},annualReports:{}});
  assert.equal(Object.hasOwn(result,'departments'),false);
});

test('academic restore checks student subjects, retention sections/years, and faculty assignments together', () => {
  const student = { ...validateModule('students',{academicYear:'2026-2027',department:'CCT Computing',studentNumber:'100',name:'CCT Student',yearLevel:1,status:'Enrolled',subjectIds:{cs1:true}}),
    departmentId:'computing',createdByUid:'admin',modifiedByUid:'admin' };
  student.id = moduleIdentity('students',student);
  const database = { access:{admin:{}}, departments:{computing:{name:'CCT Computing'}},subjects:{cs1:{department:'CCT Computing'}},students:{[student.id]:student},
    sections:{sec1:{department:'CCT Computing',departmentId:'computing',academicYear:'AY 2026-2027',createdByUid:'admin'}},
    retention:{ret1:{department:'CCT Computing',departmentId:'computing',academicYear:'AY 2026-2027',studentId:student.id,sectionId:'sec1',createdByUid:'admin'}} };
  assert.doesNotThrow(()=>validateAcademicReferences(database));
  database.subjects.cs1.department='Other CCT School';
  assert.throws(()=>validateAcademicReferences(database));
  database.subjects.cs1.department='CCT Computing';
  database.sections.sec1.academicYear='AY 2025-2026';
  assert.throws(()=>validateAcademicReferences(database));
});
