import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRecordMutation, hasRecordConflict, nextRecordRevision } from '../src/utils/recordConcurrency.js';

const record = { id:'r1', department:'Computer Studies', academicYear:'AY 2026-2027', semester:'1st Semester', subjectCode:'CS101', subjectTitle:'Computing', enrolledCount:10, passedCount:8, averageGrade:1.75, status:'Approved', revision:1 };
test('a form snapshot cannot overwrite a newer revision or a legacy-client change', () => {
  assert.equal(hasRecordConflict(record, {...record}), false);
  assert.equal(hasRecordConflict({...record,revision:2},record), true);
  assert.equal(hasRecordConflict({...record,passedCount:9},record), true);
  assert.equal(buildRecordMutation({record:{...record,passedCount:10},expected:record})({...record,revision:2}),undefined);
});
test('legacy normalization does not produce a false conflict', () => {
  const old = {...record,revision:0,academicYear:'2026-2027',subjectCode:'cs101'};
  assert.equal(hasRecordConflict(old,{...record,revision:0,failedCount:0,droppedCount:0,incCount:0,approvedAt:''}),false);
});
test('creation cannot replace an existing row; deletion and review honor access and revision', () => {
  assert.equal(buildRecordMutation({record})(record),undefined);
  assert.equal(buildRecordMutation({record,expected:record,remove:true,authorize:()=>false})(record),undefined);
  assert.equal(buildRecordMutation({record,expected:record,remove:true})(record),null);
  assert.equal(nextRecordRevision(record,{...record,revision:99}).revision,2);
});
