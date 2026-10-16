import { normalizeAcademicYear } from './academic.js';

export const recordRevision = (record) => Number(record?.revision) || 0;

// Compare the original form snapshot, not the latest React collection: a live
// update while a form is open must not silently turn a stale edit into a write.
const fields = ['department', 'programId', 'programName', 'semester',
  'subjectTitle', 'remarks', 'updatedAt', 'approvedAt',
  'submittedAt', 'reviewedAt', 'reviewNote', 'encodedById', 'encodedByUid', 'approvedByUid', 'reviewedByUid'];
const counts = ['enrolledCount', 'passedCount', 'failedCount', 'droppedCount', 'incCount'];
export const hasRecordConflict = (current, expected) => {
  if (!current || !expected || recordRevision(current) !== recordRevision(expected)) return true;
  return fields.some((field) => String(current[field] ?? '') !== String(expected[field] ?? ''))
    || (current.status || 'Draft') !== (expected.status || 'Draft')
    || normalizeAcademicYear(current.academicYear) !== normalizeAcademicYear(expected.academicYear)
    || String(current.subjectCode || '').trim().toUpperCase() !== String(expected.subjectCode || '').trim().toUpperCase()
    || counts.some((field) => Number(current[field] || 0) !== Number(expected[field] || 0))
    || Number(current.averageGrade || 1.75) !== Number(expected.averageGrade || 1.75);
};

export const nextRecordRevision = (current, changes) => ({
  ...current,
  ...changes,
  revision: recordRevision(current) + 1
});

export const buildRecordMutation = ({ record, expected = null, remove = false, authorize = () => true }) => (current) => {
  if (expected ? hasRecordConflict(current, expected) || !authorize(current) : current !== null) return undefined;
  return remove ? null : nextRecordRevision(current, record);
};
