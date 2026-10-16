export const ROLES = ['VPAA', 'President', 'Deans', 'Heads'];
export const isSafeKey = (value) => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value)
  && !['__proto__', 'constructor', 'prototype'].includes(value);
export const text = (value, label, max = 160) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max || [...value].some((character) => character.charCodeAt(0) < 32)) {
    throw new Error(`Enter a valid ${label}.`);
  }
  return value.trim();
};
export function validateAccount(input, create = false) {
  const profile = { name: text(input?.name, 'CCT display name', 100),
    role: input?.role, department: text(input?.department, 'CCT department') };
  if (!ROLES.includes(profile.role)) throw new Error('Select a supported CCT role.');
  if (create) {
    profile.email = text(input.email, 'CCT email', 254).toLowerCase();
    if (!/^[^\s@]+@college\.cct\.edu$/.test(profile.email)) throw new Error('Use a valid @college.cct.edu CCT email address.');
    if (typeof input.password !== 'string' || input.password.length < 12 || input.password.length > 128
      || !/[a-z]/.test(input.password) || !/[A-Z]/.test(input.password) || !/[0-9]/.test(input.password) || !/[^A-Za-z0-9]/.test(input.password)) {
      throw new Error('Use 12–128 characters with uppercase, lowercase, a number, and a symbol.');
    }
    profile.password = input.password;
  }
  return profile;
}
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
function inspect(value, depth = 0) {
  if (depth > 12) throw new Error('The CCT snapshot is too deeply nested.');
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key) || [...key].some((character) => '.#$[]/'.includes(character) || character.charCodeAt(0) < 32)) throw new Error('The CCT snapshot contains an unsafe key.');
    inspect(child, depth + 1);
  }
}
function entries(value, prefix) {
  if (value == null) return {};
  if (!value || typeof value !== 'object') throw new Error('CCT collections must be arrays or objects.');
  const items = Array.isArray(value) ? value.map((item, i) => [item?.id || `${prefix}_${i + 1}`, item]) : Object.entries(value);
  if (items.length > 10000) throw new Error('A CCT collection exceeds the 10,000-item limit.');
  const result = {};
  for (const [key, item] of items) {
    const id = String(item?.id || key);
    if (!isSafeKey(id) || Object.hasOwn(result, id)) throw new Error('The CCT snapshot has invalid or duplicate identifiers.');
    result[id] = typeof item === 'string' ? { id, name: item } : { ...item, id };
  }
  return result;
}
export function validateSnapshot(raw) {
  if (typeof raw !== 'string' || Buffer.byteLength(raw, 'utf8') > 10 * 1024 * 1024) throw new Error('Select a CCT JSON snapshot smaller than 10 MB.');
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Select a supported CCT JSON snapshot.');
  inspect(parsed);
  // Exported profiles and audit history are reference material; browser imports never grant access or rewrite history.
  const collections = {};
  const aliases = { requests: ['records', 'requests'], departments: ['departments'], programs: ['programs'], subjects: ['subjectCatalog', 'subjects'],
    ...Object.fromEntries(MODULE_COLLECTIONS.map((collection) => [collection, [collection]])) };
  for (const [path, keys] of Object.entries(aliases)) {
    const key = keys.find((candidate) => Object.hasOwn(parsed, candidate));
    if (key) collections[path] = entries(parsed[key], path);
  }
  if (!Object.keys(collections).length) throw new Error('No CCT records or catalog collections were found.');
  const seen = new Set();
  for (const record of Object.values(collections.requests || {})) {
    for (const field of ['department', 'academicYear', 'semester', 'subjectCode', 'subjectTitle']) record[field] = text(record[field], field);
    if (!['Approved', 'Pending Dean Approval', 'Returned for Revision'].includes(record.status)) throw new Error('Invalid CCT record status.');
    if (!['1st Semester', '2nd Semester', 'Midyear / Summer'].includes(record.semester)) throw new Error('Invalid CCT semester.');
    if (!/^AY \d{4}-\d{4}$/.test(record.academicYear)) throw new Error('Invalid CCT academic year.');
    const counts = ['enrolledCount', 'passedCount', 'failedCount', 'droppedCount', 'incCount'].map((field) => record[field]);
    if (counts.some((n) => !Number.isInteger(n) || n < 0 || n > 100000) || !counts[0] || counts.slice(1).reduce((a,b) => a+b, 0) > counts[0]) throw new Error('Invalid CCT student counts.');
    if (typeof record.averageGrade !== 'number' || record.averageGrade < 1 || record.averageGrade > 5) throw new Error('Invalid CCT average grade.');
    if (!isSafeKey(record.encodedByUid)) throw new Error('This snapshot needs verified owner UIDs. Run the CCT access migration before exporting it.');
    record.subjectCode = record.subjectCode.toUpperCase().replace(/\s+/g, ' ');
    const identity = [record.department, record.programId || record.programName || '', record.academicYear, record.semester, record.subjectCode].join('|');
    if (seen.has(identity)) throw new Error('The CCT snapshot contains duplicate reporting records.');
    seen.add(identity);
  }
  for (const department of Object.values(collections.departments || {})) department.name = text(department.name, 'CCT department');
  for (const program of Object.values(collections.programs || {})) {
    program.name = text(program.name, 'CCT program'); program.code = text(program.code, 'CCT program code', 40);
    program.department = text(program.department, 'CCT department');
  }
  for (const subject of Object.values(collections.subjects || {})) {
    subject.title = text(subject.title, 'CCT subject'); subject.code = text(subject.code, 'CCT subject code', 40);
    subject.department = text(subject.department, 'CCT department');
  }
  for (const collection of MODULE_COLLECTIONS) {
    const identities = new Set();
    for (const [id, input] of Object.entries(collections[collection] || {})) {
      const row = validateModule(collection, input);
      const identity = moduleIdentity(collection, row);
      if (identity && identities.has(identity)) throw new Error('The CCT snapshot contains duplicate academic entries for the same identifier or Academic Year.');
      identities.add(identity);
      if (!isSafeKey(input.createdByUid) || !isSafeKey(input.modifiedByUid)) throw new Error('CCT academic entries require verified owner and writer UIDs.');
      if (!GLOBAL_COLLECTIONS.includes(collection) && !isSafeKey(input.departmentId)) throw new Error('CCT academic entries require a linked school identifier.');
      const expectedId = GLOBAL_COLLECTIONS.includes(collection) || ['students', 'faculty', 'retention'].includes(collection) ? identity
        : collection === 'departmentHeads' ? 'dept_' + input.departmentId
          : collection === 'sections' ? 'cct_' + createHash('sha256').update(identity).digest('hex') : id;
      if (id !== expectedId) throw new Error('A CCT academic entry has a noncanonical identifier.');
      const allowed = new Set([...Object.keys(row), 'id', 'departmentId', 'createdByUid', 'modifiedByUid', 'revision', 'updatedAt']);
      if (Object.keys(input).some((key) => !allowed.has(key))) throw new Error('A CCT academic entry contains unsupported fields.');
      collections[collection][id] = { ...row, id, ...(GLOBAL_COLLECTIONS.includes(collection) ? {} : { departmentId: input.departmentId }),
        createdByUid: input.createdByUid, modifiedByUid: input.modifiedByUid, revision: Number(input.revision) || 1, updatedAt: String(input.updatedAt || '') };
    }
  }
  return collections;
}
import { createHash } from 'node:crypto';
import { GLOBAL_COLLECTIONS, MODULE_COLLECTIONS, moduleIdentity, validateModule } from './academicValidation.js';

// Run against the combined current database and proposed restore, before committing it.
export function validateAcademicReferences(database) {
  for (const collection of MODULE_COLLECTIONS) {
    for (const row of Object.values(database[collection] || {})) {
      if (database.access?.[row.createdByUid] == null) throw new Error('A restored CCT academic owner has no verified access profile.');
      if (GLOBAL_COLLECTIONS.includes(collection)) continue;
      if (database.departments?.[row.departmentId]?.name !== row.department) throw new Error('A CCT academic entry references a missing or different school.');
      if (collection === 'students') {
        if (row.programId && database.programs?.[row.programId]?.department !== row.department) throw new Error('A CCT student references a program in a missing or different school.');
        for (const id of Object.keys(row.subjectIds || {})) {
          const subject = database.subjects?.[id];
          if (!subject || subject.department !== row.department || (row.programId && subject.programId && subject.programId !== row.programId)) throw new Error('A CCT student references an unavailable subject or a subject in a different program.');
        }
      }
      if (collection === 'retention') {
        const student = database.students?.[row.studentId]; const section = database.sections?.[row.sectionId];
        if (!student || student.department !== row.department || !section || section.department !== row.department || section.academicYear !== row.academicYear) throw new Error('CCT retention requires a student and section in the same school, and a section with the matching Academic Year.');
      }
      if (collection === 'departmentHeads' && database.faculty?.[row.facultyId]?.department !== row.department) throw new Error('A CCT Department Head assignment references missing faculty or a different school.');
    }
  }
}
