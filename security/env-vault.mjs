import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const FORMAT = 'mywebz-env-v1';
const CIPHER = 'aes-256-gcm';
const AAD = Buffer.from(`${FORMAT}:${CIPHER}`, 'utf8');

function isEnvironmentFile(name) {
  return typeof name === 'string' && /^\.env(?:\.[a-zA-Z0-9_-]+)*$/.test(name)
    && !/^\.env\.enc(?:\.|$)/.test(name) && !/\.(example|sample|template)$/.test(name);
}

function validateFiles(files) {
  if (!Array.isArray(files) || files.length === 0) throw new Error('No environment files in backup.');
  const names = new Set();
  for (const file of files) {
    if (!file || !isEnvironmentFile(file.name) || names.has(file.name) || !Buffer.isBuffer(file.content)) {
      throw new Error('Invalid or duplicate environment filename/content.');
    }
    names.add(file.name);
  }
}

function decode(value, length) {
  if (typeof value !== 'string') throw new Error('Invalid encoding.');
  const bytes = Buffer.from(value, 'base64');
  if (bytes.toString('base64') !== value || (length !== undefined && bytes.length !== length)) {
    throw new Error('Invalid encoding.');
  }
  return bytes;
}

export function sealFiles(files, key) {
  validateFiles(files);
  if (!Buffer.isBuffer(key) || key.length !== 32) throw new Error('Expected a 32-byte encryption key.');
  const iv = randomBytes(12);
  const cipher = createCipheriv(CIPHER, key, iv, { authTagLength: 16 });
  cipher.setAAD(AAD);
  const plaintext = Buffer.from(JSON.stringify(files.map(({ name, content }) => ({ name, content: content.toString('base64') }))));
  try {
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    return JSON.stringify({ format: FORMAT, cipher: CIPHER, iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') }) + '\n';
  } finally {
    plaintext.fill(0);
  }
}

export function openFiles(encrypted, key) {
  let plaintext;
  try {
    const envelope = JSON.parse(encrypted);
    if (envelope.format !== FORMAT || envelope.cipher !== CIPHER || !Buffer.isBuffer(key) || key.length !== 32) {
      throw new Error('Invalid format or key.');
    }
    const decipher = createDecipheriv(CIPHER, key, decode(envelope.iv, 12), { authTagLength: 16 });
    decipher.setAAD(AAD);
    decipher.setAuthTag(decode(envelope.tag, 16));
    // Do not parse or restore anything until authentication succeeds.
    const unverified = decipher.update(decode(envelope.ciphertext));
    try {
      plaintext = Buffer.concat([unverified, decipher.final()]);
    } finally {
      unverified.fill(0);
    }
    const files = JSON.parse(plaintext.toString('utf8')).map(({ name, content }) => ({ name, content: decode(content) }));
    validateFiles(files);
    return files;
  } catch {
    throw new Error('Backup authentication failed: wrong key, damaged file, or unsupported format.');
  } finally {
    plaintext?.fill(0);
  }
}

function regularFile(path) {
  if (!lstatSync(path).isFile()) throw new Error(`Refusing a symlink or non-regular file: ${path}`);
}

function hidden(path, enabled = true) {
  if (process.platform === 'win32') execFileSync('attrib.exe', [enabled ? '+H' : '-H', path], { stdio: 'pipe', windowsHide: true });
}

function privateKeyPermissions(path) {
  if (process.platform === 'win32') {
    const identity = execFileSync('whoami.exe', ['/user', '/fo', 'csv', '/nh'], { encoding: 'utf8', windowsHide: true });
    const sid = identity.match(/S-1-\d+(?:-\d+)+/)?.[0];
    if (!sid) throw new Error('Unable to determine the current Windows user for key permissions.');
    execFileSync('icacls.exe', [path, '/inheritance:r', '/grant:r', `*${sid}:F`, '*S-1-5-18:F'], { stdio: 'pipe', windowsHide: true });
  } else {
    chmodSync(path, 0o600);
  }
}

function loadKey(root, keyFile, create) {
  if (create) mkdirSync(dirname(keyFile), { recursive: true, mode: 0o700 });
  if (!existsSync(dirname(keyFile))) throw new Error(`Decryption key is missing. Restore your private key to: ${keyFile}`);
  const actualKeyFile = join(realpathSync(dirname(keyFile)), basename(keyFile));
  const location = relative(realpathSync(root), actualKeyFile);
  if (!isAbsolute(location) && location !== '..' && !location.startsWith(`..${sep}`)) {
    throw new Error('The key must be stored outside the project, never alongside the encrypted backup.');
  }
  if (!existsSync(actualKeyFile)) {
    if (!create) throw new Error(`Decryption key is missing. Restore your private key to: ${actualKeyFile}`);
    const generated = randomBytes(32);
    try {
      writeFileSync(actualKeyFile, generated, { flag: 'wx', mode: 0o600 });
      privateKeyPermissions(actualKeyFile);
    } finally {
      generated.fill(0);
    }
  }
  regularFile(actualKeyFile);
  const key = readFileSync(actualKeyFile);
  if (key.length !== 32) {
    key.fill(0);
    throw new Error('Invalid key file: expected exactly 32 bytes.');
  }
  return key;
}

export function runVault(command, { root, keyFile, output } = {}) {
  root = resolve(root);
  keyFile = resolve(keyFile);
  if (!['encrypt', 'verify', 'restore'].includes(command)) throw new Error('Use encrypt, verify, or restore --output <empty-private-folder>.');
  if (command === 'restore' && !output) throw new Error('Restore requires --output <empty-private-folder>; existing files are never overwritten.');
  const bundle = join(root, '.env.enc');
  if (existsSync(bundle)) regularFile(bundle);
  const sources = command === 'encrypt' ? readdirSync(root).filter(isEnvironmentFile).sort().map(name => {
    const path = join(root, name);
    regularFile(path);
    return { name, content: readFileSync(path) };
  }) : [];
  if (command === 'encrypt') validateFiles(sources);
  const key = loadKey(root, keyFile, command === 'encrypt' && !existsSync(bundle));
  let files = [];
  try {
    if (command === 'encrypt') {
      // Confirm the old key before replacing an existing backup.
      if (existsSync(bundle)) openFiles(readFileSync(bundle, 'utf8'), key).forEach(file => file.content.fill(0));
      const encrypted = sealFiles(sources, key);
      files = openFiles(encrypted, key);
      if (files.some((file, index) => file.name !== sources[index].name || !file.content.equals(sources[index].content))) {
        throw new Error('Encryption round-trip verification failed.');
      }
      const temporary = `${bundle}.${randomBytes(8).toString('hex')}.tmp`;
      try {
        writeFileSync(temporary, encrypted, { flag: 'wx', mode: 0o600 });
        if (existsSync(bundle)) hidden(bundle, false);
        renameSync(temporary, bundle);
      } finally {
        if (existsSync(temporary)) unlinkSync(temporary);
        if (existsSync(bundle)) hidden(bundle);
      }
    } else {
      files = openFiles(readFileSync(bundle, 'utf8'), key);
      if (command === 'restore') {
        output = resolve(output);
        mkdirSync(output, { recursive: true, mode: 0o700 });
        const targets = files.map(file => join(output, file.name));
        if (targets.some(path => existsSync(path))) throw new Error('Restore refused: a destination environment file already exists.');
        const written = [];
        try {
          files.forEach((file, index) => {
            writeFileSync(targets[index], file.content, { flag: 'wx', mode: 0o600 });
            written.push(targets[index]);
          });
        } catch (error) {
          written.forEach(path => unlinkSync(path));
          throw error;
        }
      }
    }
    return { count: files.length, bundle, keyFile, output };
  } finally {
    key.fill(0);
    sources.forEach(file => file.content.fill(0));
    files.forEach(file => file.content.fill(0));
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [command, ...args] = process.argv.slice(2);
    if (args.length && !(command === 'restore' && args.length === 2 && args[0] === '--output')) {
      throw new Error('Only restore accepts additional arguments: --output <empty-private-folder>.');
    }
    const root = fileURLToPath(new URL('../', import.meta.url));
    const dataDirectory = process.platform === 'win32' ? (process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local')) : join(homedir(), '.local', 'share');
    const keyFile = process.env.MYWEBZ_ENV_KEY_FILE || join(dataDirectory, 'MyWebz', 'release-secrets', 'env.key');
    const result = runVault(command, { root, keyFile, output: args[1] });
    console.log(`${command}: ${result.count} environment file(s); authenticated AES-256-GCM backup.`);
    console.log(`Encrypted release file: ${result.bundle}`);
    console.log(`Private key (keep separate; never upload): ${result.keyFile}`);
    if (result.output) console.log(`Restored plaintext files to: ${result.output}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
