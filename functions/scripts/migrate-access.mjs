import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { isSafeKey, ROLES } from '../validation.js';
import { createCliCredential } from './cli-credential.mjs';
import { applyVerifiedAccessMappings } from '../accessMigration.js';

const args = process.argv.slice(2);
const argument = (name) => args[args.indexOf(name) + 1];
const projectId = argument('--project');
if (!args.includes('--project') || projectId !== 'academicdashboarddata') throw new Error('Explicitly select Firebase project academicdashboarddata.');
const options = { projectId, databaseURL: 'https://academicdashboarddata-default-rtdb.asia-southeast1.firebasedatabase.app' };
// Optional bridge to an explicitly selected, already-authorized Firebase CLI account. Tokens stay in memory.
if (args.includes('--cli-path') && args.includes('--cli-account')) {
  options.credential = createCliCredential(argument('--cli-path'), argument('--cli-account'));
}
const app = initializeApp(options);
const rest = async (path, init = {}) => {
  const credential = options.credential || app.options.credential;
  const token = await credential.getAccessToken();
  const response = await fetch(options.databaseURL + path + '.json', { ...init,
    headers: { Authorization: 'Bearer ' + token.access_token, 'Content-Type': 'application/json', ...init.headers },
    signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error('CCT database request failed with HTTP ' + response.status);
  return response;
};
const authentication = getAuth(app);
const directory = await (await rest('/accounts')).json() || {};
const departments = await (await rest('/departments')).json() || {};
const schoolNames = new Set(Object.values(departments).map((school) => typeof school === 'string' ? school : school?.name).filter(Boolean));
const emailChanges = [];
if (args.includes('--migrate-emails')) {
  for (const [id, profile] of Object.entries(directory)) {
    const previous = String(profile.email || '').trim().toLowerCase();
    const next = previous.replace(/\.imus@college\.cvt\.edu$/, '@college.cct.edu').replace(/@college\.cvt\.edu$/, '@college.cct.edu');
    if (next !== previous) {
      emailChanges.push({ id, previous, next });
      profile.email = next;
    }
  }
  if (new Set(Object.values(directory).map((profile) => profile.email)).size !== Object.keys(directory).length) throw new Error('CCT email migration would create duplicate profiles.');
}
const mappings = {};
const unresolved = [];
for (const [id, account] of Object.entries(directory)) {
  if (!isSafeKey(id) || !ROLES.includes(account.role) || !['Active', 'Suspended'].includes(account.status) || !account.department || !account.email) {
    unresolved.push({ id, reason: 'Incomplete CCT directory profile' }); continue;
  }
  if (['Deans', 'Heads'].includes(account.role) && !schoolNames.has(account.department)) {
    unresolved.push({ id, reason: 'Assigned CCT school is missing from the department directory' }); continue;
  }
  try {
    let user;
    try { user = await authentication.getUserByEmail(account.email); }
    catch (error) {
      const change = emailChanges.find((item) => item.id === id);
      if (error.code !== 'auth/user-not-found' || !change) throw error;
      user = await authentication.getUserByEmail(change.previous);
    }
    if (mappings[user.uid]) throw new Error('Duplicate directory email');
    mappings[user.uid] = { accountId: id, role: account.role, department: account.department,
      status: user.disabled ? 'Suspended' : account.status };
  } catch (error) { unresolved.push({ id, reason: error.code || error.message }); }
}
const vpaaCount = Object.values(mappings).filter((access) => access.role === 'VPAA' && access.status === 'Active').length;
console.log(JSON.stringify({ projectId, emailChanges, verifiedAccounts: Object.keys(mappings).length, activeVpaaAccounts: vpaaCount, unresolved }, null, 2));
if (!vpaaCount) throw new Error('No verified active CCT VPAA exists. Resolve the administrator profile before enforcing rules.');
if (args.includes('--apply')) {
  const byAccountId = Object.fromEntries(Object.entries(mappings).map(([uid, access]) => [access.accountId, uid]));
  const response = await rest('/', { headers: { 'X-Firebase-ETag': 'true' } });
  const current = await response.json();
  const currentDirectory = structuredClone(current?.accounts);
  for (const change of emailChanges) {
    if (currentDirectory?.[change.id]?.email !== change.previous) throw new Error('CCT profile changed during migration. Rerun the dry run.');
    currentDirectory[change.id].email = change.next;
  }
  if (!current || JSON.stringify(currentDirectory) !== JSON.stringify(directory)) throw new Error('CCT directory changed. Rerun the dry run.');
    const next = applyVerifiedAccessMappings(current, mappings, directory);
    for (const change of emailChanges) {
      const uid = byAccountId[change.id];
      if (uid) await authentication.updateUser(uid, { email: change.next });
      next.accounts[change.id] = { ...next.accounts[change.id], email: change.next };
    }
  await rest('/', { method: 'PUT', headers: { 'if-match': response.headers.get('etag') }, body: JSON.stringify(next) });
  console.log('Verified CCT access mappings applied atomically. Existing records and account IDs were preserved.');
} else console.log('Dry run only. Use --apply after reviewing the mapping summary.');
await app.delete();
