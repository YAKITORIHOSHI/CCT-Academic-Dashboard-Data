import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/auth';
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Edit3,
  FileSpreadsheet,
  Filter,
  PlusCircle,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  X,
  XCircle
} from 'lucide-react';
import { CustomSelect } from '../components/common/CustomSelect';
import { ConfirmDialog, Toast } from '../components/common/Feedback';
import { Modal } from '../components/common/Modal';
import { SubjectCombobox } from '../components/common/SubjectCombobox';
import {
  buildAcademicYearOptions,
  getCurrentAcademicYear,
  RECORD_STATUS,
  SEMESTER_OPTIONS
} from '../utils/academic';

const STATUS_STYLES = {
  [RECORD_STATUS.APPROVED]: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300',
  [RECORD_STATUS.PENDING]: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/70 dark:text-amber-300',
  [RECORD_STATUS.RETURNED]: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/70 dark:text-rose-300',
  [RECORD_STATUS.DRAFT]: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
};

const StatusBadge = ({ status }) => {
  const Icon = status === RECORD_STATUS.APPROVED
    ? CheckCircle2
    : status === RECORD_STATUS.RETURNED
      ? RotateCcw
      : Clock3;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${STATUS_STYLES[status] || STATUS_STYLES[RECORD_STATUS.DRAFT]}`}>
      <Icon className="h-3 w-3" />
      {status || RECORD_STATUS.DRAFT}
    </span>
  );
};

const Metric = ({ label, value, emphasis = '' }) => (
  <div className="mini-metric rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/70">
    <div className="text-xs font-bold tracking-normal text-slate-500 dark:text-slate-400">{label}</div>
    <div className={`mt-0.5 font-mono text-sm font-semibold text-slate-800 dark:text-slate-100 ${emphasis}`}>{value}</div>
  </div>
);

const numberFromField = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const RecordsPage = () => {
  const {
    currentUser,
    records,
    addRecord,
    updateRecord,
    reviewRecord,
    deleteRecord,
    departments,
    programs,
    subjectCatalog,
    permissions,
    canEditRecord,
    canDeleteRecord,
    canApproveRecord
  } = useAuth();

  const academicYears = useMemo(() => buildAcademicYearOptions(records), [records]);
  const defaultDepartment = permissions.canViewAllDepartments ? departments[0] : (currentUser?.department || '');
  const defaultAcademicYear = getCurrentAcademicYear();

  const emptyForm = () => ({
    department: defaultDepartment,
    programId: '',
    programName: '',
    academicYear: defaultAcademicYear,
    semester: '1st Semester',
    subjectCode: '',
    subjectTitle: '',
    enrolledCount: '',
    passedCount: '',
    failedCount: '0',
    droppedCount: '0',
    incCount: '0',
    averageGrade: '1.75',
    remarks: '',
    status: permissions.isHead ? RECORD_STATUS.PENDING : RECORD_STATUS.APPROVED
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState(permissions.canViewAllDepartments ? 'ALL' : (currentUser?.department || ''));
  const [programFilter, setProgramFilter] = useState('ALL');
  const [ayFilter, setAyFilter] = useState('ALL');
  const [semFilter, setSemFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [reviewState, setReviewState] = useState(null);
  const [reviewNote, setReviewNote] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [notice, setNotice] = useState(null);

  const availablePrograms = useMemo(() => programs
    .filter((program) => program.department === formData.department)
    .sort((a, b) => `${a.code || ''} ${a.name}`.localeCompare(`${b.code || ''} ${b.name}`)),
  [formData.department, programs]);

  const availableSubjects = useMemo(() => {
    const catalog = Array.isArray(subjectCatalog) ? subjectCatalog : [];
    return catalog.filter((subject) => {
      const isInstitutionWide = subject.department === 'All Academic Units' || subject.department === 'ALL';
      if (!isInstitutionWide && subject.department !== formData.department) return false;
      if (!subject.programId) return true;
      return Boolean(formData.programId) && subject.programId === formData.programId;
    });
  }, [formData.department, formData.programId, subjectCatalog]);

  const filterPrograms = useMemo(() => programs
    .filter((program) => deptFilter === 'ALL' || program.department === deptFilter)
    .sort((a, b) => `${a.department} ${a.code || ''} ${a.name}`.localeCompare(`${b.department} ${b.code || ''} ${b.name}`)),
  [deptFilter, programs]);

  useEffect(() => {
    if (programFilter === 'ALL' || programFilter === '__DEPARTMENT_WIDE__') return;
    if (!filterPrograms.some((program) => program.id === programFilter)) setProgramFilter('ALL');
  }, [filterPrograms, programFilter]);

  useEffect(() => {
    setDeptFilter(permissions.canViewAllDepartments ? 'ALL' : (currentUser?.department || ''));
    setIsModalOpen(false);
    setReviewState(null);
  }, [currentUser?.id, currentUser?.department, permissions.canViewAllDepartments]);

  const scopedRecords = useMemo(() => records.filter((record) => {
    if (permissions.canViewAllDepartments) return true;
    return record.department === currentUser?.department;
  }), [records, currentUser?.department, permissions.canViewAllDepartments]);

  const filteredRecords = useMemo(() => scopedRecords.filter((record) => {
    const query = searchTerm.trim().toLowerCase();
    const matchesSearch = !query || [
      record.subjectCode,
      record.subjectTitle,
      record.encodedBy,
      record.department,
      record.programName,
      record.remarks
    ].some((value) => String(value || '').toLowerCase().includes(query));

    return matchesSearch
      && (deptFilter === 'ALL' || record.department === deptFilter)
      && (programFilter === 'ALL' || (programFilter === '__DEPARTMENT_WIDE__' ? !record.programId : record.programId === programFilter))
      && (ayFilter === 'ALL' || record.academicYear === ayFilter)
      && (semFilter === 'ALL' || record.semester === semFilter)
      && (statusFilter === 'ALL' || record.status === statusFilter);
  }), [scopedRecords, searchTerm, deptFilter, programFilter, ayFilter, semFilter, statusFilter]);

  const pendingCount = scopedRecords.filter((record) => record.status === RECORD_STATUS.PENDING).length;
  const approvedCount = scopedRecords.filter((record) => record.status === RECORD_STATUS.APPROVED).length;
  const returnedCount = scopedRecords.filter((record) => record.status === RECORD_STATUS.RETURNED).length;

  const liveEnrolled = numberFromField(formData.enrolledCount);
  const livePassed = numberFromField(formData.passedCount);
  const liveFailed = numberFromField(formData.failedCount);
  const liveDropped = numberFromField(formData.droppedCount);
  const liveInc = numberFromField(formData.incCount);
  const classifiedTotal = livePassed + liveFailed + liveDropped + liveInc;
  const livePassingRate = liveEnrolled > 0 ? ((livePassed / liveEnrolled) * 100).toFixed(2) : '0.00';

  const openAddModal = () => {
    setEditingRecord(null);
    setFormData(emptyForm());
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (record) => {
    setEditingRecord(record);
    setFormData({
      department: record.department,
      programId: record.programId || '',
      programName: record.programName || '',
      academicYear: record.academicYear,
      semester: record.semester,
      subjectCode: record.subjectCode,
      subjectTitle: record.subjectTitle,
      enrolledCount: String(record.enrolledCount),
      passedCount: String(record.passedCount),
      failedCount: String(record.failedCount),
      droppedCount: String(record.droppedCount || 0),
      incCount: String(record.incCount || 0),
      averageGrade: String(record.averageGrade),
      remarks: record.remarks || '',
      status: record.status || RECORD_STATUS.DRAFT
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSaving) return;
    setFormError('');

    if (!formData.department || !formData.academicYear || !formData.semester) {
      setFormError('Academic unit, academic year, and semester are required.');
      return;
    }
    if (!formData.subjectCode.trim() || !formData.subjectTitle.trim()) {
      setFormError('Subject code and title are required.');
      return;
    }
    const outcomeCounts = [liveEnrolled, livePassed, liveFailed, liveDropped, liveInc];
    if (outcomeCounts.some((count) => !Number.isInteger(count))) {
      setFormError('Student counts must be whole numbers.');
      return;
    }
    if (liveEnrolled <= 0) {
      setFormError('Enrolled students must be greater than zero.');
      return;
    }
    if ([livePassed, liveFailed, liveDropped, liveInc].some((count) => count < 0)) {
      setFormError('Student outcome counts cannot be negative.');
      return;
    }
    if (classifiedTotal > liveEnrolled) {
      setFormError(`Student outcomes total ${classifiedTotal}, which exceeds enrolled students (${liveEnrolled}).`);
      return;
    }
    const averageGrade = Number.parseFloat(formData.averageGrade);
    if (!Number.isFinite(averageGrade) || averageGrade < 1 || averageGrade > 5) {
      setFormError('Average grade must be between 1.00 and 5.00.');
      return;
    }
    const normalizedCode = formData.subjectCode.trim().toUpperCase().replace(/\s+/g, ' ');
    const duplicate = records.find((record) => record.id !== editingRecord?.id
      && record.department === formData.department
      && String(record.programId || record.programName || '') === String(formData.programId || formData.programName || '')
      && record.academicYear === formData.academicYear
      && record.semester === formData.semester
      && String(record.subjectCode || '').trim().toUpperCase().replace(/\s+/g, ' ') === normalizedCode);
    if (duplicate) {
      setFormError(`A ${formData.subjectCode} record already exists for this program, year, and semester.`);
      return;
    }

    const payload = {
      ...formData,
      subjectCode: normalizedCode,
      subjectTitle: formData.subjectTitle.trim(),
      programId: formData.programId || '',
      programName: formData.programName || '',
      enrolledCount: liveEnrolled,
      passedCount: livePassed,
      failedCount: liveFailed,
      droppedCount: liveDropped,
      incCount: liveInc,
      averageGrade,
      remarks: formData.remarks.trim()
    };
    setIsSaving(true);
    const result = editingRecord
      ? await updateRecord(editingRecord.id, payload, editingRecord)
      : await addRecord(payload);
    setIsSaving(false);

    if (!result?.success) {
      setFormError(result?.message || 'The record could not be saved.');
      return;
    }
    setIsModalOpen(false);
    setNotice({
      type: 'success',
      message: editingRecord
        ? `${normalizedCode} was updated successfully.`
        : permissions.isHead
          ? `${normalizedCode} was submitted for dean approval.`
          : `${normalizedCode} was saved as an approved record.`
    });
  };

  const handleDelete = (record) => {
    setDeleteTarget(record);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (isSaving) return;
    setIsSaving(true);
    const result = await deleteRecord(deleteTarget.id, deleteTarget);
    setIsSaving(false);
    if (!result?.success) {
      setNotice({ type: 'error', message: result?.message || 'Unable to delete the record.' });
      return;
    }
    setNotice({ type: 'success', message: `${deleteTarget.subjectCode} was deleted.` });
    setDeleteTarget(null);
  };

  const openReviewModal = (record, decision) => {
    setReviewState({ record, decision });
    setReviewNote('');
  };

  const submitReview = async () => {
    if (!reviewState) return;
    if (reviewState.decision === 'return' && !reviewNote.trim()) return;
    if (isSaving) return;
    setIsSaving(true);
    const result = await reviewRecord(reviewState.record.id, reviewState.decision, reviewNote, reviewState.record);
    setIsSaving(false);
    if (!result?.success) {
      setNotice({ type: 'error', message: result?.message || 'Unable to complete the review.' });
      return;
    }
    setNotice({
      type: 'success',
      message: reviewState.decision === 'approve'
        ? `${reviewState.record.subjectCode} was approved.`
        : `${reviewState.record.subjectCode} was returned for revision.`
    });
    setReviewState(null);
  };

  const renderActions = (record, compact = false) => {
    const showApproval = record.status === RECORD_STATUS.PENDING && canApproveRecord(record);
    const iconClass = compact ? 'h-4 w-4' : 'h-3.5 w-3.5';

    return (
      <div className={`flex flex-wrap items-center ${compact ? 'gap-1' : 'gap-2'}`}>
        {showApproval && (
          <>
            <button
              type="button"
              onClick={() => openReviewModal(record, 'approve')}
              className="control-lift primary-action inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 py-2 text-xs font-bold text-white transition hover:bg-emerald-700"
              title="Approve record"
            >
              <CheckCircle2 className={iconClass} />
              {!compact && 'Approve'}
            </button>
            <button
              type="button"
              onClick={() => openReviewModal(record, 'return')}
              className="control-lift inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
              title="Return for revision"
            >
              <RotateCcw className={iconClass} />
              {!compact && 'Return'}
            </button>
          </>
        )}

        {canEditRecord(record) && (
          <button
            type="button"
            onClick={() => openEditModal(record)}
            className="control-lift inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-600 transition hover:border-crimson-200 hover:text-crimson-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-crimson-800 dark:hover:text-crimson-300"
            title="Edit record"
          >
            <Edit3 className={iconClass} />
            {!compact && 'Edit'}
          </button>
        )}

        {canDeleteRecord(record) && (
          <button
            type="button"
            onClick={() => handleDelete(record)}
            className="control-lift inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-500 transition hover:border-rose-200 hover:text-rose-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-rose-800 dark:hover:text-rose-300"
            title="Delete record"
          >
            <Trash2 className={iconClass} />
            {!compact && 'Delete'}
          </button>
        )}
      </div>
    );
  };

  const roleMessage = permissions.isVPAA
    ? 'Full authority: edit, approve, return, or delete any academic record.'
    : permissions.isPresident
      ? 'Executive oversight: view approved and in-progress records without changing data.'
      : permissions.isDean
        ? `Review and approve records for ${currentUser.department}.`
        : `Encode records for ${currentUser.department} and submit them for dean approval.`;

  return (
    <div className="page-stack space-y-4 sm:space-y-5">
      <section className="hero-panel hero-motion relative overflow-hidden rounded-2xl border border-gold-500/30 bg-gradient-to-br from-slate-950 via-crimson-950 to-gold-950 p-5 text-white sm:p-6 lg:p-7 shadow-xl shadow-gold-950/40">
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-gold-500/25 blur-3xl" />
        <div className="absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-crimson-600/20 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-normal text-gold-400">
              <FileSpreadsheet className="h-4 w-4" />
              Academic Records Management
            </div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">CCT Academic Records</h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gold-100/90 sm:text-sm">{roleMessage}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-gold-400/30 bg-crimson-900/40 px-3 py-1.5 text-xs font-bold text-gold-200">
                <ShieldCheck className="h-3.5 w-3.5 text-gold-400" /> {currentUser?.role}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-gold-400/30 bg-crimson-900/40 px-3 py-1.5 text-xs font-bold text-gold-200">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Visible records: {scopedRecords.length}
              </span>
            </div>
          </div>

          {permissions.canCreateRecords && (
            <button
              type="button"
              onClick={openAddModal}
              className="hero-action button-shine inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-gold-300 to-gold-500 hover:from-gold-200 hover:to-gold-400 px-4 text-sm font-semibold text-slate-950 transition shadow-lg shadow-gold-500/25 cursor-pointer"
            >
              <PlusCircle className="h-4 w-4" />
              {permissions.isHead ? 'Encode and Submit' : 'Add Academic Record'}
            </button>
          )}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Visible records" value={scopedRecords.length} />
        <Metric label="Approved" value={approvedCount} emphasis="text-emerald-600 dark:text-emerald-400" />
        <Metric label="Pending review" value={pendingCount} emphasis="text-amber-600 dark:text-amber-400" />
        <Metric label="Returned" value={returnedCount} emphasis="text-rose-600 dark:text-rose-400" />
      </section>

      <section className="surface-panel surface-panel-hover relative z-30 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 sm:p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-normal text-slate-500 dark:text-slate-400">
          <Filter className="h-4 w-4 text-crimson-500" />
          Search and Filters
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <label className="relative sm:col-span-2 xl:col-span-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
            <input
              type="search"
              aria-label="Search Academic Records"
              placeholder="Search subject, program, encoder, unit, or remarks"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="form-control pl-9"
            />
          </label>

          {permissions.canViewAllDepartments && (
            <CustomSelect
              value={deptFilter}
              onChange={(value) => {
                setDeptFilter(value);
                setProgramFilter('ALL');
              }}
              options={[
                { value: 'ALL', label: 'All academic units' },
                ...departments.map((department) => ({ value: department, label: department }))
              ]}
            />
          )}

          <CustomSelect
            value={programFilter}
            onChange={setProgramFilter}
            options={[
              { value: 'ALL', label: 'All programs' },
              { value: '__DEPARTMENT_WIDE__', label: 'Department-wide' },
              ...filterPrograms.map((program) => ({
                value: program.id,
                label: `${program.code ? `${program.code} — ` : ''}${program.name}`
              }))
            ]}
            ariaLabel="Program filter"
          />

          <CustomSelect
            value={ayFilter}
            onChange={setAyFilter}
            options={[
              { value: 'ALL', label: 'All academic years' },
              ...academicYears.map((year) => ({ value: year, label: year }))
            ]}
          />

          <CustomSelect
            value={semFilter}
            onChange={setSemFilter}
            options={[
              { value: 'ALL', label: 'All semesters' },
              ...SEMESTER_OPTIONS.map((semester) => ({ value: semester, label: semester }))
            ]}
          />

          <CustomSelect
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'ALL', label: 'All statuses' },
              ...Object.values(RECORD_STATUS).map((status) => ({ value: status, label: status }))
            ]}
          />
        </div>
        <div className="mt-3 text-xs font-medium text-slate-500 dark:text-slate-400">Showing {filteredRecords.length} of {scopedRecords.length} records</div>
      </section>

      <section className="surface-panel hidden overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 xl:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold tracking-normal text-slate-500 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3.5">Subject</th>
                <th className="px-4 py-3.5">Academic Unit</th>
                <th className="px-4 py-3.5">Term</th>
                <th className="px-4 py-3.5">Outcomes</th>
                <th className="px-4 py-3.5 text-center">Rate / Grade</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">Encoded / Reviewed</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredRecords.map((record) => (
                <tr key={record.id} className="table-row-lift align-top transition hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-4">
                    <div className="font-mono text-sm font-semibold text-crimson-700 dark:text-crimson-300">{record.subjectCode}</div>
                    <div className="mt-1 max-w-[15rem] font-bold text-slate-900 dark:text-white">{record.subjectTitle}</div>
                  </td>
                  <td className="max-w-[15rem] px-4 py-4 text-xs font-medium leading-relaxed text-slate-600 dark:text-slate-300"><div>{record.department}</div><div className="mt-1 text-xs font-bold text-gold-700 dark:text-gold-300">{record.programName || 'Department-wide'}</div></td>
                  <td className="px-4 py-4">
                    <div className="font-bold text-slate-800 dark:text-slate-200">{record.academicYear}</div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{record.semester}</div>
                  </td>
                  <td className="px-4 py-4 font-mono text-xs text-slate-500 dark:text-slate-400">
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                      <span>Enrolled <b className="text-slate-800 dark:text-slate-200">{record.enrolledCount}</b></span>
                      <span>Passed <b className="text-emerald-600 dark:text-emerald-400">{record.passedCount}</b></span>
                      <span>Failed <b className="text-rose-600 dark:text-rose-400">{record.failedCount}</b></span>
                      <span>Dropped <b>{record.droppedCount || 0}</b></span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div className="font-mono text-base font-semibold text-slate-900 dark:text-white">{record.passingRate}%</div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Avg. {record.averageGrade}</div>
                  </td>
                  <td className="px-4 py-4">
                    <StatusBadge status={record.status} />
                    {record.reviewNote && <p className="mt-2 max-w-[13rem] text-xs leading-relaxed text-slate-500 dark:text-slate-400">{record.reviewNote}</p>}
                  </td>
                  <td className="px-4 py-4 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    <div className="font-semibold text-slate-700 dark:text-slate-300">{record.encodedBy}</div>
                    <div>{record.updatedAt}</div>
                    {record.approvedBy && <div className="mt-1 text-emerald-600 dark:text-emerald-400">Approved by {record.approvedBy}</div>}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex justify-end">{renderActions(record, true)}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredRecords.length === 0 && <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">No records match the selected filters.</div>}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:hidden">
        {filteredRecords.map((record) => (
          <article key={record.id} className="surface-panel surface-panel-hover interactive-surface rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-mono text-sm font-semibold text-crimson-700 dark:text-crimson-300">{record.subjectCode}</div>
                <h2 className="mt-1 text-sm font-semibold leading-snug text-slate-950 dark:text-white">{record.subjectTitle}</h2>
              </div>
              <StatusBadge status={record.status} />
            </div>

            <div className="mt-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
              <p className="text-xs font-bold leading-relaxed text-slate-600 dark:text-slate-300">{record.department}</p>
              <p className="mt-1 text-xs font-semibold text-gold-700 dark:text-gold-300">{record.programName || 'Department-wide'}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{record.academicYear} · {record.semester}</p>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <Metric label="Enrolled" value={record.enrolledCount} />
              <Metric label="Passed" value={record.passedCount} emphasis="text-emerald-600 dark:text-emerald-400" />
              <Metric label="Failed" value={record.failedCount} emphasis="text-rose-600 dark:text-rose-400" />
              <Metric label="Dropped" value={record.droppedCount || 0} />
              <Metric label="Incomplete" value={record.incCount || 0} />
              <Metric label="Pass rate" value={`${record.passingRate}%`} emphasis="text-crimson-600 dark:text-crimson-400" />
            </div>

            <div className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <div className="flex items-center justify-between gap-3"><span>Encoded by</span><span className="truncate font-semibold text-slate-700 dark:text-slate-300">{record.encodedBy}</span></div>
              <div className="mt-1 flex items-center justify-between"><span>Average grade</span><span className="font-mono font-bold">{record.averageGrade}</span></div>
              {record.reviewNote && <div className="mt-2 rounded-lg bg-slate-50 p-2 leading-relaxed dark:bg-slate-800">{record.reviewNote}</div>}
            </div>

            {(canEditRecord(record) || canDeleteRecord(record) || (record.status === RECORD_STATUS.PENDING && canApproveRecord(record))) && (
              <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">{renderActions(record)}</div>
            )}
          </article>
        ))}
        {filteredRecords.length === 0 && (
          <div className="sm:col-span-2 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500 dark:text-slate-400 dark:border-slate-700 dark:bg-slate-900">No records match the selected filters.</div>
        )}
      </section>

      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        align="bottom"
        backdropClassName="mobile-sheet-backdrop"
        ariaLabel={editingRecord ? 'Edit academic performance record' : 'New academic performance record'}
        className="flex max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom))] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 sm:max-h-[94dvh] sm:rounded-2xl"
      >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-4 dark:border-slate-800 sm:p-5">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold tracking-normal text-crimson-600 dark:text-crimson-400">
                  <ShieldCheck className="h-4 w-4" />
                  {editingRecord ? 'Update Record' : permissions.isHead ? 'Submit for Approval' : 'Authorized Record Entry'}
                </div>
                <h2 className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">{editingRecord ? `${editingRecord.subjectCode} — Edit details` : 'New CCT Academic Record'}</h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {permissions.isHead ? 'Saving will send this record to the assigned dean for approval.' : 'Dean and VPAA entries are approved immediately unless the VPAA selects another status.'}
                </p>
              </div>
              <button type="button" onClick={() => setIsModalOpen(false)} className="control-lift icon-control grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700" aria-label="Close form">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-4 sm:p-5">
                {formError && (
                  <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{formError}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <span className="form-label">Academic Unit</span>
                    <CustomSelect
                      value={formData.department}
                      disabled={!permissions.canViewAllDepartments}
                      onChange={(val) => setFormData((previous) => ({
                        ...previous,
                        department: val,
                        programId: '',
                        programName: '',
                        subjectCode: '',
                        subjectTitle: ''
                      }))}
                      options={departments.map((d) => ({ value: d, label: d }))}
                      ariaLabel="Academic unit"
                    />
                  </div>

                  <div>
                    <span className="form-label">Program / Curriculum Scope <span className="optional-label">(Optional)</span></span>
                    <CustomSelect
                      value={formData.programId || '__DEPARTMENT_WIDE__'}
                      onChange={(value) => {
                        const selectedProgram = availablePrograms.find((program) => program.id === value);
                        setFormData((previous) => ({
                          ...previous,
                          programId: value === '__DEPARTMENT_WIDE__' ? '' : value,
                          programName: selectedProgram?.name || '',
                          subjectCode: '',
                          subjectTitle: ''
                        }));
                      }}
                      options={[
                        { value: '__DEPARTMENT_WIDE__', label: 'Department-wide / common subjects' },
                        ...availablePrograms.map((program) => ({ value: program.id, label: `${program.code ? `${program.code} — ` : ''}${program.name}` }))
                      ]}
                      ariaLabel="Academic program"
                    />
                  </div>

                  <div>
                    <span className="form-label">Academic Year</span>
                    <CustomSelect
                      value={formData.academicYear}
                      onChange={(val) => setFormData({ ...formData, academicYear: val })}
                      options={academicYears.map((year) => ({ value: year, label: year }))}
                      ariaLabel="Academic year"
                    />
                  </div>

                  <div>
                    <span className="form-label">Semester</span>
                    <CustomSelect
                      value={formData.semester}
                      onChange={(val) => setFormData({ ...formData, semester: val })}
                      options={SEMESTER_OPTIONS.map((s) => ({ value: s, label: s }))}
                      ariaLabel="Semester"
                    />
                  </div>

                  <label>
                    <span className="form-label">Subject Code</span>
                    <SubjectCombobox
                      value={formData.subjectCode}
                      subjects={availableSubjects}
                      onInputChange={(code) => {
                        const matched = availableSubjects.find((subject) => subject.code.toUpperCase() === code.trim().toUpperCase());
                        setFormData((previous) => ({
                          ...previous,
                          subjectCode: code,
                          subjectTitle: matched ? matched.title : previous.subjectTitle
                        }));
                      }}
                      onSelect={(subject) => setFormData((previous) => ({
                        ...previous,
                        subjectCode: subject.code,
                        subjectTitle: subject.title
                      }))}
                    />
                  </label>

                  <label>
                    <span className="form-label">Subject Title</span>
                    <input
                      type="text"
                      required
                      value={formData.subjectTitle}
                      onChange={(event) => setFormData({ ...formData, subjectTitle: event.target.value })}
                      placeholder="Enter subject title"
                      className="form-control"
                    />
                  </label>

                  {permissions.isVPAA && editingRecord && (
                    <div>
                      <span className="form-label">Workflow Status</span>
                      <CustomSelect
                        value={formData.status}
                        onChange={(val) => setFormData({ ...formData, status: val })}
                        options={Object.values(RECORD_STATUS).map((s) => ({ value: s, label: s }))}
                        ariaLabel="Workflow status"
                      />
                    </div>
                  )}
                </div>

                <div className="inset-panel rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                  <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Student Outcomes</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Passed + failed + dropped + incomplete must not exceed enrolled.</p>
                    </div>
                    <div className={`text-xs font-bold ${classifiedTotal > liveEnrolled && liveEnrolled > 0 ? 'text-rose-600' : 'text-slate-500 dark:text-slate-400'}`}>
                      Classified: {classifiedTotal} / {liveEnrolled || 0}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {[
                      ['Enrolled', 'enrolledCount', 1],
                      ['Passed', 'passedCount', 0],
                      ['Failed', 'failedCount', 0],
                      ['Dropped', 'droppedCount', 0],
                      ['Incomplete', 'incCount', 0]
                    ].map(([label, field, min]) => (
                      <label key={field}>
                        <span className="form-label">{label} {min === 0 && field !== 'passedCount' && <span className="optional-label">(Optional)</span>}</span>
                        <input
                          type="number"
                          min={min}
                          required={field === 'enrolledCount' || field === 'passedCount'}
                          value={formData[field]}
                          onChange={(event) => setFormData({ ...formData, [field]: event.target.value })}
                          className="form-control font-mono"
                        />
                      </label>
                    ))}
                    <label>
                      <span className="form-label">Average Grade</span>
                      <input type="number" required step="0.01" min="1" max="5" value={formData.averageGrade} onChange={(event) => setFormData({ ...formData, averageGrade: event.target.value })} className="form-control font-mono" />
                    </label>
                  </div>

                  <div className="mt-4 flex items-center justify-between rounded-xl border border-crimson-100 bg-white px-3 py-2.5 dark:border-crimson-900 dark:bg-slate-900">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Calculated passing rate</span>
                    <span className="font-mono text-lg font-semibold text-crimson-700 dark:text-crimson-300">{livePassingRate}%</span>
                  </div>
                </div>

                <label>
                  <span className="form-label">Evaluation Notes / Remarks <span className="optional-label">(Optional)</span></span>
                  <textarea rows="4" value={formData.remarks} onChange={(event) => setFormData({ ...formData, remarks: event.target.value })} placeholder="Document observations, interventions, or context for the reviewer." className="form-control resize-y" />
                </label>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:justify-end sm:p-5">
                <button type="button" onClick={() => setIsModalOpen(false)} className="control-lift min-h-11 rounded-xl bg-slate-100 px-4 text-sm font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700">Cancel</button>
                <button type="submit" disabled={isSaving} aria-busy={isSaving} className="primary-action button-shine inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-crimson-600 px-5 text-sm font-bold text-white hover:bg-crimson-700">
                  {permissions.isHead ? <ClipboardCheck className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                  {isSaving ? 'Saving…' : editingRecord ? (permissions.isHead ? 'Save and Resubmit' : 'Save Changes') : (permissions.isHead ? 'Submit for Dean Approval' : 'Save Approved Record')}
                </button>
              </div>
            </form>
      </Modal>

      <Modal
        open={Boolean(reviewState)}
        onClose={() => setReviewState(null)}
        ariaLabel="Review academic record"
        zIndex={110}
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-6"
      >
        {reviewState && (
          <div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className={`flex items-center gap-2 text-xs font-semibold tracking-normal ${reviewState.decision === 'approve' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {reviewState.decision === 'approve' ? <CheckCircle2 className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
                  Dean Review Decision
                </div>
                <h2 className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
                  {reviewState.decision === 'approve' ? 'Approve' : 'Return'} {reviewState.record.subjectCode}
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{reviewState.record.subjectTitle}</p>
              </div>
              <button type="button" onClick={() => setReviewState(null)} aria-label="Close Review" className="control-lift icon-control grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300"><X className="h-4 w-4" /></button>
            </div>

            <div className="mt-4 rounded-2xl bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
              <div className="flex justify-between gap-4"><span>Department</span><span className="text-right font-bold">{reviewState.record.department}</span></div>
              <div className="mt-1 flex justify-between gap-4"><span>Passing rate</span><span className="font-mono font-semibold">{reviewState.record.passingRate}%</span></div>
              <div className="mt-1 flex justify-between gap-4"><span>Encoded by</span><span className="text-right font-bold">{reviewState.record.encodedBy}</span></div>
            </div>

            <label className="mt-4 block">
              <span className="form-label">Review Note <span className="optional-label">{reviewState.decision === 'return' ? '(Required)' : '(Optional)'}</span></span>
              <textarea rows="4" required={reviewState.decision === 'return'} value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} placeholder={reviewState.decision === 'approve' ? 'Add validation notes for the audit trail.' : 'Explain what must be corrected before resubmission.'} className="form-control resize-none" />
            </label>

            {reviewState.decision === 'return' && !reviewNote.trim() && (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400"><AlertCircle className="h-3.5 w-3.5" />A correction note is required.</p>
            )}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setReviewState(null)} className="control-lift min-h-11 rounded-xl bg-slate-100 px-4 text-sm font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">Cancel</button>
              <button
                type="button"
                disabled={isSaving || (reviewState.decision === 'return' && !reviewNote.trim())}
                onClick={submitReview}
                className={`primary-action button-shine inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 ${reviewState.decision === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}
              >
                {reviewState.decision === 'approve' ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                {reviewState.decision === 'approve' ? 'Confirm Approval' : 'Return for Revision'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete academic record?"
        message={deleteTarget
          ? `${deleteTarget.subjectCode} — ${deleteTarget.subjectTitle}\n\nThis permanently removes the record and its audit-visible workflow data.`
          : ''}
        confirmLabel="Delete record"
        onConfirm={confirmDelete}
        busy={isSaving}
        onCancel={() => setDeleteTarget(null)}
      />

      <Toast
        message={notice?.message}
        type={notice?.type}
        onClose={() => setNotice(null)}
      />
    </div>
  );
};
