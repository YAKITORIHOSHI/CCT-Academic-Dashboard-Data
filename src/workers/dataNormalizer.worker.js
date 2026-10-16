import { firebaseCollectionRows } from '../services/firebaseSafety.js';

const normalizeAcademicYear = (value) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  return /^AY\s+/i.test(trimmed) ? trimmed.replace(/^ay/i, 'AY') : `AY ${trimmed}`;
};

const normalizeRecords = (items) => items.map((record) => {
  const enrolledCount = Math.max(0, Number.parseInt(record.enrolledCount, 10) || 0);
  const passedCount = Math.max(0, Number.parseInt(record.passedCount, 10) || 0);
  const failedCount = Math.max(0, Number.parseInt(record.failedCount, 10) || 0);
  const droppedCount = Math.max(0, Number.parseInt(record.droppedCount, 10) || 0);
  const incCount = Math.max(0, Number.parseInt(record.incCount, 10) || 0);

  return {
    ...record,
    academicYear: normalizeAcademicYear(record.academicYear),
    status: record.status || 'Draft',
    enrolledCount,
    passedCount,
    failedCount,
    droppedCount,
    incCount,
    passingRate: enrolledCount > 0 ? Number(((passedCount / enrolledCount) * 100).toFixed(2)) : 0,
    averageGrade: Math.min(5, Math.max(1, Number.parseFloat(record.averageGrade) || 1.75)),
    programId: String(record.programId || '').trim(),
    programName: String(record.programName || '').trim(),
    approvedBy: record.approvedBy || '',
    approvedAt: record.approvedAt || '',
    reviewNote: record.reviewNote || ''
  };
});

const normalizePrograms = (items) => items.map((program) => ({
  ...program,
  code: String(program.code || '').trim().toUpperCase(),
  name: String(program.name || '').trim(),
  department: String(program.department || '').trim()
})).filter((program) => program.id && program.name && program.department);

const normalizeSubjects = (items) => items.map((subject) => ({
  ...subject,
  code: String(subject.code || '').trim().toUpperCase().replace(/\s+/g, ' '),
  title: String(subject.title || '').trim(),
  department: String(subject.department || '').trim(),
  programId: String(subject.programId || '').trim(),
  programName: String(subject.programName || '').trim()
})).filter((subject) => subject.id && subject.code && subject.title && subject.department);

self.onmessage = (event) => {
  const { requestId, collection, value } = event.data || {};

  try {
    const items = firebaseCollectionRows(value, { allowStrings: collection === 'departments' });
    let result = items;

    if (collection === 'requests') result = normalizeRecords(items);
    if (collection === 'departments') {
      result = items.map((item) => (typeof item === 'string' ? item : item?.name || item?.id)).filter(Boolean);
    }
    if (collection === 'programs') result = normalizePrograms(items);
    if (collection === 'subjects') result = normalizeSubjects(items);

    self.postMessage({ requestId, success: true, result });
  } catch (error) {
    self.postMessage({
      requestId,
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
};
