const normalizeAcademicYear = (value) => {
  const trimmed = String(value || '').trim();
  return /^AY\s+/i.test(trimmed) ? trimmed.replace(/^ay/i, 'AY') : 'AY ' + trimmed;
};

export const YEAR_LEVELS = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year'];
export const STUDENT_STATUSES = ['Enrolled', 'On Leave', 'Withdrawn', 'Graduated'];
export const MOVEMENTS = ['Retained', 'Shiftee', 'Transferee', 'Withdrawn', 'Graduated'];
export const MODULE_COLLECTIONS = ['annualReports', 'students', 'sections', 'retention', 'faculty', 'departmentHeads', 'achievements', 'topcit'];
export const PRIVATE_COLLECTIONS = ['students', 'retention'];
export const GLOBAL_COLLECTIONS = ['annualReports', 'topcit'];
const keySafe = (value) => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value) && !['__proto__', 'constructor', 'prototype'].includes(value);
const cleanText = (value, label, max = 160) => {
  const text = String(value ?? '').trim();
  if (!text || text.length > max || [...text].some((char) => char.charCodeAt(0) < 32)) throw new Error(`Enter a valid ${label} (up to ${max} characters).`);
  return text;
};
const optionalText = (value, max = 2000) => {
  const text = String(value || '').trim();
  if (text.length > max) throw new Error(`Notes must be ${max} characters or fewer.`);
  return text;
};
const wholeCount = (value, label) => {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 100000) throw new Error(`${label} must be a whole number between 0 and 100,000.`);
  return number;
};
export function validateModule(collection, input) {
  if (!MODULE_COLLECTIONS.includes(collection)) throw new Error('Unsupported CCT collection.');
  const academicYear = normalizeAcademicYear(input.academicYear);
  const match = academicYear.match(/^AY (\d{4})-(\d{4})$/);
  if (collection !== 'departmentHeads' && (!match || Number(match[2]) !== Number(match[1]) + 1)) throw new Error('Select a valid consecutive Academic Year.');
  let row = collection === 'departmentHeads' ? {} : { academicYear };
  if (!GLOBAL_COLLECTIONS.includes(collection)) row.department = cleanText(input.department, 'CCT school');
  switch (collection) {
    case 'annualReports': case 'topcit': {
      const prefix = collection === 'annualReports' ? 'year' : 'level';
      for (let i = 1; i <= 5; i += 1) row[prefix + i] = wholeCount(input[prefix + i], `${collection === 'annualReports' ? 'Year' : 'Level'} ${i}`);
      row.total = [1,2,3,4,5].reduce((sum, i) => sum + row[prefix + i], 0);
      row.notes = optionalText(input.notes);
      break;
    }
    case 'students': {
      row.studentNumber = cleanText(input.studentNumber, 'student number', 40).toUpperCase();
      if (!/^[A-Z0-9_-]{1,40}$/.test(row.studentNumber)) throw new Error('Student numbers can contain letters, numbers, hyphens, and underscores.');
      row.name = cleanText(input.name, 'student name', 100);
      row.programId = String(input.programId || '');
      row.yearLevel = Number(input.yearLevel);
      row.status = input.status;
      if (!YEAR_LEVELS[row.yearLevel - 1]) throw new Error('Select a valid year level.');
      if (!STUDENT_STATUSES.includes(row.status)) throw new Error('Select a valid student status.');
      if (row.programId && !keySafe(row.programId)) throw new Error('Select a valid CCT program.');
      row.subjectIds = {};
      for (const [id, included] of Object.entries(input.subjectIds || {})) {
        if (!keySafe(id) || included !== true) throw new Error('Select valid CCT subjects.');
        row.subjectIds[id] = true;
      }
      if (Object.keys(row.subjectIds).length > 30) throw new Error('A student can have at most 30 current subject assignments.');
      row.notes = optionalText(input.notes);
      break;
    }
    case 'sections': {
      row.name = cleanText(input.name, 'section name', 60);
      row.yearLevel = Number(input.yearLevel);
      if (!YEAR_LEVELS[row.yearLevel - 1]) throw new Error('Select a valid section year level.');
      break;
    }
    case 'retention': {
      row.studentId = input.studentId; row.sectionId = input.sectionId;
      if (!keySafe(row.studentId) || !keySafe(row.sectionId)) throw new Error('Select a student and a section.');
      row.movement = input.movement;
      if (!MOVEMENTS.includes(row.movement)) throw new Error('Select a valid retention status.');
      row.destination = optionalText(input.destination, 160);
      if (['Shiftee', 'Transferee'].includes(row.movement) && !row.destination) throw new Error('Enter the destination program or school.');
      row.notes = optionalText(input.notes);
      break;
    }
    case 'faculty': {
      row.staffNumber = cleanText(input.staffNumber, 'faculty number', 40).toUpperCase();
      if (!/^[A-Z0-9_-]{1,40}$/.test(row.staffNumber)) throw new Error('Faculty numbers can contain letters, numbers, hyphens, and underscores.');
      row.name = cleanText(input.name, 'faculty name', 100);
      row.rating = Number(input.rating);
      if (!Number.isFinite(row.rating) || row.rating < 1 || row.rating > 5) throw new Error('Faculty rating must be between 1.00 and 5.00.');
      row.notes = optionalText(input.notes);
      break;
    }
    case 'departmentHeads': {
      row.facultyId = input.facultyId;
      if (!keySafe(row.facultyId)) throw new Error('Select a faculty member.');
      break;
    }
    case 'achievements': {
      row.title = cleanText(input.title, 'achievement title', 180);
      row.description = optionalText(input.description);
      row.achievedOn = String(input.achievedOn || '');
      if (row.achievedOn && !/^\d{4}-\d{2}-\d{2}$/.test(row.achievedOn)) throw new Error('Enter a valid achievement date.');
      break;
    }
  }
  return row;
}
export function moduleIdentity(collection, row) {
  if (GLOBAL_COLLECTIONS.includes(collection)) return row.academicYear.replace(/^AY /, 'AY_').replace('-', '_');
  if (collection === 'students') return 'stu_' + row.studentNumber;
  if (collection === 'sections') return JSON.stringify([row.department, row.academicYear, row.name.toUpperCase()]);
  if (collection === 'retention') return 'ret_' + row.studentId + '_' + row.academicYear.replaceAll(' ', '_').replaceAll('-', '_');
  if (collection === 'faculty') return 'fac_' + row.staffNumber + '_' + row.academicYear.replaceAll(' ', '_').replaceAll('-', '_');
  if (collection === 'departmentHeads') return row.department;
  return null;
}
export function hasModuleConflict(current, expected) {
  if (!current || !expected || Number(current.revision || 0) !== Number(expected.revision || 0)) return true;
  const normalize = (value) => JSON.stringify(Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'id').sort(([a],[b]) => a.localeCompare(b))));
  return normalize(current) !== normalize(expected);
}
export function buildModuleMutation(row, expected = null, remove = false) {
  return (current) => {
    if (expected ? hasModuleConflict(current, expected) : current !== null) return undefined;
    return remove ? null : { ...row, revision: Number(current?.revision || 0) + 1 };
  };
}
