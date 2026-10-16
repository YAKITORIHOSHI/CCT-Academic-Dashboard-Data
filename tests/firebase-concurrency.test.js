import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import { getDatabase, connectDatabaseEmulator, ref, set, get, onValue, push } from 'firebase/database';
import { runRecordTransaction } from '../src/services/recordTransactions.js';

// This suite can only connect to the local emulator, never the real CCT project.
const clients = ['device-a','device-b'].map((name) => {
  const app = initializeApp({projectId:'demo-cct-concurrency',databaseURL:'https://demo-cct-concurrency-default-rtdb.firebaseio.com'},name);
  const db = getDatabase(app); connectDatabaseEmulator(db,'127.0.0.1',19000); return {app,db};
});
const row = {id:'record',department:'Computer Studies',academicYear:'AY 2026-2027',semester:'1st Semester',subjectCode:'CS101',subjectTitle:'Computing',status:'Pending Dean Approval',enrolledCount:100,passedCount:90,revision:1};
test('two devices: one competing creation commits and both receive the live record', {timeout:15000}, async () => {
  const path='creation/record'; await set(ref(clients[0].db,path),null);
  const live = new Promise((resolve) => { const off=onValue(ref(clients[1].db,path),(snapshot)=>{if(snapshot.exists()){off();resolve(snapshot.val());}}); });
  const results=await Promise.all(clients.map(({db})=>runRecordTransaction(db,path,{record:row})));
  assert.equal(results.filter(r=>r.committed).length,1); assert.equal((await live).subjectCode,'CS101');
});
test('two devices editing the same revision cannot lose each other’s changes', {timeout:15000}, async () => {
  const path='editing/record'; await set(ref(clients[0].db,path),row);
  await Promise.all(clients.map(({db})=>get(ref(db,path))));
  const changes=[{...row,passedCount:92},{...row,passedCount:96}];
  const results=await Promise.all(clients.map(({db},index)=>runRecordTransaction(db,path,{record:changes[index],expected:row})));
  assert.equal(results.filter(r=>r.committed).length,1); const saved=(await get(ref(clients[1].db,path))).val();
  assert.equal(saved.revision,2); assert.ok([92,96].includes(saved.passedCount));
  const staleDelete=await runRecordTransaction(clients[0].db,path,{record:row,expected:row,remove:true});
  assert.equal(staleDelete.committed,false); assert.equal((await get(ref(clients[1].db,path))).val().revision,2);
});
test('simultaneous additions use independent keys without replacing a collection', {timeout:15000}, async () => {
  const additions=Array.from({length:24},(_,index)=>{const {db}=clients[index%2];const target=push(ref(db,'independent'));return {target,index};});
  assert.equal(new Set(additions.map(a=>a.target.key)).size,24);
  await Promise.all(additions.map(({target,index})=>set(target,{index})));
  assert.equal(Object.keys((await get(ref(clients[0].db,'independent'))).val()).length,24);
});
test('deleted records cannot be resurrected by stale forms or an old account session', {timeout:15000}, async () => {
  const path='deleted/record'; await set(ref(clients[0].db,path),row);
  await set(ref(clients[1].db,path),null);
  const stale=await runRecordTransaction(clients[0].db,path,{record:row,expected:row});
  assert.equal(stale.committed,false); assert.equal((await get(ref(clients[1].db,path))).exists(),false);
  const cancelled=await runRecordTransaction(clients[0].db,'cancelled/record',{record:row},()=>false);
  assert.equal(cancelled.committed,false); assert.equal((await get(ref(clients[1].db,'cancelled/record'))).exists(),false);
});
test.after(async () => { await Promise.all(clients.map(({app})=>deleteApp(app))); });
