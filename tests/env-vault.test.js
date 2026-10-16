import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { openFiles, runVault, sealFiles } from '../security/env-vault.mjs';

const original = [
  { name: '.env', content: Buffer.from('PRIVATE_TOKEN=test-only-secret\r\n') },
  { name: '.env.local', content: Buffer.from([0xef, 0xbb, 0xbf, 0x41, 0x3d, 0x31, 0x0a]) },
];

test('environment encryption preserves exact bytes and uses a fresh nonce on every backup', () => {
  const key = randomBytes(32);
  const first = sealFiles(original, key);
  const second = sealFiles(original, key);
  assert.notEqual(JSON.parse(first).iv, JSON.parse(second).iv);
  assert.deepEqual(openFiles(first, key), original);
  assert.deepEqual(openFiles(second, key), original);
  assert.ok(!first.includes('test-only-secret'));
  assert.ok(!first.includes('.env.local'));
});

test('wrong keys, corrupt ciphertext, modified tags/nonces/metadata and malformed backups fail authentication', () => {
  const key = randomBytes(32);
  const encrypted = sealFiles(original, key);
  assert.throws(() => openFiles(encrypted, randomBytes(32)), /authentication failed/);
  for (const field of ['ciphertext', 'tag', 'iv']) {
    const envelope = JSON.parse(encrypted);
    const bytes = Buffer.from(envelope[field], 'base64');
    bytes[0] ^= 1;
    envelope[field] = bytes.toString('base64');
    assert.throws(() => openFiles(JSON.stringify(envelope), key), /authentication failed/);
  }
  for (const value of ['', '{}', encrypted.slice(0, -10), encrypted.replace('mywebz-env-v1', 'mywebz-env-v2'), encrypted.replace('aes-256-gcm', 'aes-256-cbc')]) {
    assert.throws(() => openFiles(value, key), /authentication failed/);
  }
});

test('unsafe restore filenames, duplicates, templates and key material cannot enter the backup', () => {
  for (const name of ['../.env', '.env/../../escape', 'env.key', '.env.enc', '.env.example', '.env.local\\escape']) {
    assert.throws(() => sealFiles([{ name, content: Buffer.from('secret') }], randomBytes(32)), /Invalid/);
  }
  assert.throws(() => sealFiles([original[0], original[0]], randomBytes(32)), /duplicate/);
});

function fixture(t) {
  const temporaryRoot = realpathSync(tmpdir());
  const temporary = mkdtempSync(join(temporaryRoot, 'mywebz-env-vault-'));
  t.after(() => {
    const target = realpathSync(temporary);
    assert.equal(dirname(target), temporaryRoot);
    assert.match(basename(target), /^mywebz-env-vault-/);
    rmSync(target, { recursive: true, force: true });
  });
  const root = join(temporary, 'project');
  mkdirSync(root);
  original.forEach(file => writeFileSync(join(root, file.name), file.content));
  writeFileSync(join(root, '.env.example'), 'PLACEHOLDER=\n');
  return { root, keyFile: join(temporary, 'private', 'env.key'), output: join(temporary, 'restored') };
}

test('backup, refresh, verification and restore work without overwriting existing environment files', t => {
  const options = fixture(t);
  assert.equal(runVault('encrypt', options).count, 2);
  assert.equal(readFileSync(options.keyFile).length, 32);
  assert.equal(runVault('verify', options).count, 2);
  const first = readFileSync(join(options.root, '.env.enc'), 'utf8');
  runVault('encrypt', options);
  assert.notEqual(readFileSync(join(options.root, '.env.enc'), 'utf8'), first);
  assert.equal(runVault('restore', options).count, 2);
  original.forEach(file => assert.deepEqual(readFileSync(join(options.output, file.name)), file.content));
  assert.ok(!existsSync(join(options.output, '.env.example')));
  assert.throws(() => runVault('restore', options), /already exists/);
  original.forEach(file => assert.deepEqual(readFileSync(join(options.output, file.name)), file.content));
  assert.throws(() => runVault('restore', { ...options, output: undefined }), /requires --output/);
});

test('keys inside the project are refused and missing/wrong keys cannot replace an existing backup', t => {
  const options = fixture(t);
  assert.throws(() => runVault('encrypt', { ...options, keyFile: join(options.root, 'private', 'env.key') }), /outside the project/);
  runVault('encrypt', options);
  const bundle = join(options.root, '.env.enc');
  const before = readFileSync(bundle);
  assert.throws(() => runVault('encrypt', { ...options, keyFile: join(options.root, '..', 'missing.key') }), /key is missing/);
  writeFileSync(options.keyFile, randomBytes(32));
  assert.throws(() => runVault('encrypt', options), /authentication failed/);
  assert.deepEqual(readFileSync(bundle), before);
  assert.throws(() => runVault('restore', options), /authentication failed/);
  assert.ok(!existsSync(options.output));
});
