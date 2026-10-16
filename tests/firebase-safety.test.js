import { test } from 'node:test';
import assert from 'node:assert/strict';
import { firebaseCollectionRows, firebaseErrorMessage, firebaseOperationResult, subscribeSafely, withFirebaseReadDeadline, initializeFirebaseServices, initializeFirebaseAnalytics } from '../src/services/firebaseSafety.js';

test('missing Firebase collections are empty, sparse legacy arrays remain readable, and keys remain authoritative', () => {
  for (const value of [null,undefined,{},[]]) assert.deepEqual(firebaseCollectionRows(value),[]);
  assert.deepEqual(firebaseCollectionRows([null,{id:'legacy',name:'CCT'},null]),[{id:'legacy',name:'CCT'}]);
  assert.equal(firebaseCollectionRows({actual:{id:'wrong',name:'CCT'}})[0].id,'actual');
  assert.deepEqual(firebaseCollectionRows({school:'CCT Computing'},{allowStrings:true}),[{id:'school',name:'CCT Computing',value:'CCT Computing'}]);
});
test('corrupt collections are rejected rather than reported as missing or converted to fake records', () => {
  for (const value of [false,12,'wrong',{student:false},{student:[]},{student:'wrong'}]) assert.throws(()=>firebaseCollectionRows(value),{code:'firebase/invalid-data'});
});

test('public actions handle rejected promises and missing response data without reporting success', async () => {
  const failure=await firebaseOperationResult(async()=>{throw Object.assign(new Error('Denied'),{code:'PERMISSION_DENIED'});});
  assert.equal(failure.success,false);
  for (const value of [undefined,null,{}, {success:true}]) assert.equal((await firebaseOperationResult(()=>value,'save','record')).success,false);
  const saved={success:true,record:{id:'record'}};
  assert.deepEqual(await firebaseOperationResult(()=>saved,'save','record'),saved);
  const invalid={success:false,message:'Choose an existing CCT school.'};
  assert.deepEqual(await firebaseOperationResult(()=>invalid),invalid);
});
test('subscription setup, malformed snapshots, and async callback failures are handled and stale callbacks are ignored', async () => {
  const failures=[];
  const stopped=subscribeSafely(()=>{throw Object.assign(new Error('Denied'),{code:'PERMISSION_DENIED'});},()=>({}),()=>{},error=>failures.push(error.code));
  stopped(); assert.deepEqual(failures,['PERMISSION_DENIED']);
  let callback; let unsubscribed=0;
  const off=subscribeSafely((source,next)=>{callback=next;return()=>{unsubscribed++;};},()=>({}),async()=>{throw new Error('Callback failed');},error=>failures.push(error.message));
  callback({}); await new Promise(setImmediate);
  assert.ok(failures.includes('Callback failed'));
  off(); callback({}); await new Promise(setImmediate);
  assert.equal(unsubscribed,1); assert.equal(failures.filter(value=>value==='Callback failed').length,1);
  const corrupt=subscribeSafely((source,next)=>{next({val:()=>true});return()=>{};},()=>({}),snapshot=>firebaseCollectionRows(snapshot.val()),error=>failures.push(error.code));
  corrupt(); assert.ok(failures.includes('firebase/invalid-data'));
});
test('read deadlines reject unavailable reads and preserve permission failures while allowing absent data', async () => {
  assert.equal(await withFirebaseReadDeadline(()=>null,20),null);
  await assert.rejects(withFirebaseReadDeadline(()=>new Promise(()=>{}),5),{code:'firebase/read-timeout'});
  await assert.rejects(withFirebaseReadDeadline(()=>{throw Object.assign(new Error('Denied'),{code:'PERMISSION_DENIED'});},20),{code:'PERMISSION_DENIED'});
  assert.match(firebaseErrorMessage({code:'PERMISSION_DENIED'}),/permission/);
  assert.match(firebaseErrorMessage({code:'firebase/read-timeout'}),/Reconnect/);
  assert.match(firebaseErrorMessage({code:'firebase/invalid-data'}),/invalid database/);
});
const services = () => {
  const app={name:'[DEFAULT]'}; const auth={}; const rtdb={}; const functions={};
  return {getApps:()=>[],initializeApp:()=>app,getApp:()=>app,initializeAuth:()=>auth,getAuth:()=>auth,getDatabase:()=>rtdb,getFunctions:()=>functions,
    browserLocalPersistence:'local',browserSessionPersistence:'session',initializeAppCheck:()=>{},ReCaptchaEnterpriseProvider:class {}};
};
test('Firebase initializes its default app even when another named app already exists', () => {
  const sdk=services(); sdk.getApps=()=>[{name:'other-project'}]; sdk.getApp=()=>{throw new Error('No default app');};
  assert.equal(initializeFirebaseServices({},sdk).initializationError,null);
});
test('only already-initialized Auth uses the existing service; bad initialization fails safely', () => {
  const sdk=services(); sdk.initializeAuth=()=>{throw Object.assign(new Error('Existing Auth'),{code:'auth/already-initialized'});};
  assert.equal(initializeFirebaseServices({},sdk).initializationError,null);
  for (const method of ['initializeApp','initializeAuth','getDatabase','initializeAppCheck']) {
    const failed=services(); failed[method]=()=>{throw Object.assign(new Error('Invalid configuration'),{code:'firebase/invalid-config'});};
    failed.getAuth=()=>{throw new Error('An invalid Auth configuration must not fall back.');};
    const result=initializeFirebaseServices({},failed,{appCheckSiteKey:'configured-key'});
    assert.equal(result.initializationError.code,'firebase/invalid-config');
    for (const service of ['app','auth','rtdb','functions']) assert.equal(result[service],null);
  }
});

test('a stale default app cannot connect services to another project, database or web app', () => {
  const config = { projectId: 'academicdashboarddata', databaseURL: 'https://selected.example', appId: 'selected-app' };
  for (const field of ['projectId', 'databaseURL', 'appId']) {
    const sdk = services();
    const app = { name: '[DEFAULT]', options: { ...config, [field]: 'different-project-value' } };
    sdk.getApps = () => [app]; sdk.getApp = () => app;
    sdk.initializeAuth = () => { throw new Error('Auth must not start against mismatched configuration.'); };
    const result = initializeFirebaseServices(config, sdk);
    assert.equal(result.initializationError.code, 'firebase/project-mismatch');
    for (const service of ['app', 'auth', 'rtdb', 'functions']) assert.equal(result[service], null);
  }
  const sdk = services();
  sdk.initializeApp = () => ({ name: '[DEFAULT]', options: config });
  assert.equal(initializeFirebaseServices(config, sdk).initializationError, null);
});

test('optional analytics initializes for supported browsers and safely skips missing apps, unsupported browsers and failures', async () => {
  const app = {}; const analytics = {};
  const sdk = { isSupported: async () => true, getAnalytics: selected => { assert.equal(selected, app); return analytics; } };
  assert.equal(await initializeFirebaseAnalytics(app, sdk), analytics);
  assert.equal(await initializeFirebaseAnalytics(null, { isSupported: () => { throw new Error('Must not run without an app.'); } }), null);
  assert.equal(await initializeFirebaseAnalytics(app, { ...sdk, isSupported: async () => false, getAnalytics: () => { throw new Error('Unsupported browser.'); } }), null);
  assert.equal(await initializeFirebaseAnalytics(app, { ...sdk, isSupported: async () => { throw new Error('Unavailable storage.'); } }), null);
  assert.equal(await initializeFirebaseAnalytics(app, { ...sdk, getAnalytics: () => { throw new Error('Analytics unavailable.'); } }), null);
});
