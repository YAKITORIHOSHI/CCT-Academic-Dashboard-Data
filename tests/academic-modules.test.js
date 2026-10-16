import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateModule, moduleIdentity, buildModuleMutation } from '../src/utils/academicModules.js';

test('annual keys ignore timestamps and counts; concurrent submissions cannot replace a year', () => {
  const input={academicYear:'2026-2027',year1:10,year2:12,year3:9,year4:8,year5:0};
  const first=validateModule('annualReports',input); const changed=validateModule('annualReports',{...input,year1:99,timestamp:Date.now()});
  assert.equal(moduleIdentity('annualReports',first),moduleIdentity('annualReports',changed));
  assert.equal(first.total,39);
  assert.equal(buildModuleMutation(changed)(first),undefined);
});
test('all year-level totals are validated; invalid years and non-integer counts are rejected',()=>{
  const input={academicYear:'AY 2026-2027',level1:1,level2:2,level3:3,level4:4,level5:5};
  assert.equal(validateModule('topcit',input).total,15);
  assert.throws(()=>validateModule('topcit',{...input,level1:-1}));
  assert.throws(()=>validateModule('topcit',{...input,level1:1.5}));
  assert.throws(()=>validateModule('topcit',{...input,academicYear:'AY 2026-2030'}));
});
test('student identity is stable across academic progression and excludes birthdays',()=>{
  const first=validateModule('students',{academicYear:'2026-2027',department:'CCT Computing',studentNumber:'2026-001',name:'CCT Student',yearLevel:1,status:'Enrolled',birthday:'2005-01-01',subjectIds:{cs1:true}});
  assert.equal(moduleIdentity('students',first),'stu_2026-001');
  assert.equal(moduleIdentity('students',{...first,academicYear:'AY 2027-2028'}),'stu_2026-001');
  assert.equal(Object.hasOwn(first,'birthday'),false);
});
test('shiftee and transferee tracking requires a destination and uses one student/year key',()=>{
  const row={academicYear:'2026-2027',department:'CCT Computing',studentId:'stu_2026-001',sectionId:'section1',movement:'Shiftee'};
  assert.throws(()=>validateModule('retention',row));
  const first=validateModule('retention',{...row,destination:'CCT Business'});
  const second=validateModule('retention',{...row,movement:'Transferee',destination:'Other School'});
  assert.equal(moduleIdentity('retention',first),moduleIdentity('retention',second));
});
test('stale academic edits are rejected instead of losing another user’s changes',()=>{
  const original={id:'record',name:'Original',revision:1};
  assert.equal(buildModuleMutation({...original,name:'Change'},original)({...original,name:'Another change',revision:2}),undefined);
  assert.equal(buildModuleMutation({...original,name:'Change'},original)(original).revision,2);
});
