import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/auth';
import { useAcademicData } from '../context/academicData';
import { firebaseErrorMessage } from '../services/firebaseSafety';
import { CustomSelect } from '../components/common/CustomSelect';
import { ConfirmDialog } from '../components/common/Feedback';
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Building,
  CheckCircle2,
  Database,
  GraduationCap,
  Landmark,
  Layers,
  Plus,
  Sliders,
  Trash2
} from 'lucide-react';

const ALL_DEPARTMENTS = '__ALL_DEPARTMENTS__';
const ALL_PROGRAMS = '__ALL_PROGRAMS__';
const DEPARTMENT_WIDE = '__DEPARTMENT_WIDE__';

const Message = ({ value }) => {
  if (!value?.text) return null;
  const isError = value.type === 'error';
  return (
    <div className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${isError
        ? 'border-rose-800 bg-rose-950/70 text-rose-200'
        : 'border-emerald-800 bg-emerald-950/70 text-emerald-200'
      }`}>
      {isError ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
      <span>{value.text}</span>
    </div>
  );
};

const EmptyState = ({ children }) => (
  <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400 dark:border-slate-700">
    {children}
  </div>
);

export const InstitutionalUnitPage = ({ setActiveTab }) => {
  const {
    permissions,
    departments,
    programs,
    subjectCatalog,
    dataSync,
    addDepartment,
    deleteDepartment,
    addProgram,
    deleteProgram,
    addSubjectToCatalog,
    deleteSubjectFromCatalog
  } = useAuth();
  const academicData = useAcademicData();

  const [pendingDelete, setPendingDelete] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);

  const [newDepartmentName, setNewDepartmentName] = useState('');
  const [departmentMessage, setDepartmentMessage] = useState(null);

  const [programDepartment, setProgramDepartment] = useState('');
  const [newProgramCode, setNewProgramCode] = useState('');
  const [newProgramName, setNewProgramName] = useState('');
  const [programMessage, setProgramMessage] = useState(null);

  const [catalogDepartment, setCatalogDepartment] = useState(ALL_DEPARTMENTS);
  const [catalogProgram, setCatalogProgram] = useState(ALL_PROGRAMS);
  const [subjectDepartment, setSubjectDepartment] = useState('');
  const [subjectProgram, setSubjectProgram] = useState(DEPARTMENT_WIDE);
  const [newSubjectCode, setNewSubjectCode] = useState('');
  const [newSubjectTitle, setNewSubjectTitle] = useState('');
  const [subjectMessage, setSubjectMessage] = useState(null);

  useEffect(() => {
    if (!departments.length) {
      setProgramDepartment('');
      setSubjectDepartment('');
      return;
    }
    if (!departments.includes(programDepartment)) setProgramDepartment(departments[0]);
    if (!departments.includes(subjectDepartment)) setSubjectDepartment(departments[0]);
  }, [departments, programDepartment, subjectDepartment]);

  useEffect(() => {
    setSubjectProgram(DEPARTMENT_WIDE);
  }, [subjectDepartment]);

  useEffect(() => {
    if (catalogDepartment !== ALL_DEPARTMENTS && !departments.includes(catalogDepartment)) {
      setCatalogDepartment(ALL_DEPARTMENTS);
      return;
    }
    if (catalogProgram === ALL_PROGRAMS || catalogProgram === DEPARTMENT_WIDE) return;
    const programStillVisible = programs.some((program) => (
      program.id === catalogProgram
      && (catalogDepartment === ALL_DEPARTMENTS || program.department === catalogDepartment)
    ));
    if (catalogProgram !== ALL_PROGRAMS && catalogProgram !== DEPARTMENT_WIDE && !programStillVisible) {
      setCatalogProgram(ALL_PROGRAMS);
    }
  }, [catalogDepartment, catalogProgram, departments, programs]);

  useEffect(() => {
    if (subjectProgram === DEPARTMENT_WIDE) return;
    const selectedProgramExists = programs.some((program) => (
      program.id === subjectProgram && program.department === subjectDepartment
    ));
    if (!selectedProgramExists) setSubjectProgram(DEPARTMENT_WIDE);
  }, [programs, subjectDepartment, subjectProgram]);

  const programsForProgramForm = useMemo(
    () => programs.filter((program) => program.department === programDepartment)
      .sort((a, b) => `${a.code} ${a.name}`.localeCompare(`${b.code} ${b.name}`)),
    [programDepartment, programs]
  );

  const programsForSubject = useMemo(
    () => programs.filter((program) => program.department === subjectDepartment)
      .sort((a, b) => `${a.code} ${a.name}`.localeCompare(`${b.code} ${b.name}`)),
    [programs, subjectDepartment]
  );

  const catalogPrograms = useMemo(() => {
    const list = catalogDepartment === ALL_DEPARTMENTS
      ? programs
      : programs.filter((program) => program.department === catalogDepartment);
    return [...list].sort((a, b) => `${a.department} ${a.code} ${a.name}`.localeCompare(`${b.department} ${b.code} ${b.name}`));
  }, [catalogDepartment, programs]);

  const displayedSubjects = useMemo(() => subjectCatalog
    .filter((subject) => catalogDepartment === ALL_DEPARTMENTS || subject.department === catalogDepartment)
    .filter((subject) => {
      if (catalogProgram === ALL_PROGRAMS) return true;
      if (catalogProgram === DEPARTMENT_WIDE) return !subject.programId;
      return subject.programId === catalogProgram;
    })
    .sort((a, b) => `${a.department} ${a.programName || ''} ${a.code}`.localeCompare(`${b.department} ${b.programName || ''} ${b.code}`)),
    [catalogDepartment, catalogProgram, subjectCatalog]);

  const subjectGroups = useMemo(() => displayedSubjects.reduce((groups, subject) => {
    const key = `${subject.department}::${subject.programId || DEPARTMENT_WIDE}`;
    if (!groups[key]) {
      groups[key] = {
        department: subject.department,
        programName: subject.programName || 'Department-wide subjects',
        subjects: []
      };
    }
    groups[key].subjects.push(subject);
    return groups;
  }, {}), [displayedSubjects]);

  const runCatalogForm = async (setter, task, onSuccess) => {
    if (savingRef.current) return;
    savingRef.current = true; setIsSaving(true); setter(null);
    try {
      const result = await task();
      if (!result?.success) { setter({ type: 'error', text: result?.message || 'The CCT change could not be completed.' }); return; }
      setter({ type: 'success', text: onSuccess(result) });
    } catch (error) {
      setter({ type: 'error', text: firebaseErrorMessage(error, 'save') });
    } finally { savingRef.current = false; setIsSaving(false); }
  };
  const handleAddDepartment = async (event) => {
    event.preventDefault();
    await runCatalogForm(setDepartmentMessage, () => addDepartment(newDepartmentName), (result) => {
      setNewDepartmentName('');
      return `Academic unit "${result.department}" was saved to Firebase.`;
    });
  };
  const handleAddProgram = async (event) => {
    event.preventDefault();
    await runCatalogForm(setProgramMessage, () => addProgram({ code: newProgramCode, name: newProgramName, department: programDepartment }), (result) => {
      const message = `Program "${result.program.name}" was saved to Firebase.`;
      setNewProgramCode(''); setNewProgramName(''); return message;
    });
  };
  const handleAddSubject = async (event) => {
    event.preventDefault();
    await runCatalogForm(setSubjectMessage, () => addSubjectToCatalog({ code: newSubjectCode, title: newSubjectTitle, department: subjectDepartment,
      programId: subjectProgram === DEPARTMENT_WIDE ? '' : subjectProgram }), (result) => {
      const message = `Subject ${result.subject.code} was saved to ${result.subject.programName || 'the department-wide catalog'}.`;
      setNewSubjectCode(''); setNewSubjectTitle(''); return message;
    });
  };

  const confirmDelete = async () => {
    if (!pendingDelete || savingRef.current) return;
    const setter = pendingDelete.type === 'department' ? setDepartmentMessage : pendingDelete.type === 'program' ? setProgramMessage : setSubjectMessage;
    await runCatalogForm(setter, async () => {
      const referenced = pendingDelete.type === 'department'
        ? ['students','sections','retention','faculty','departmentHeads','achievements'].some((collection) => academicData[collection].some((row) => row.department === pendingDelete.name))
        : academicData.students.some((student) => pendingDelete.type === 'program' ? student.programId === pendingDelete.id : student.subjectIds?.[pendingDelete.id]);
      if (academicData.sync.loading || academicData.sync.error) return { success: false, message: 'Wait for CCT academic data to synchronize before removing catalog entries.' };
      if (referenced) return { success: false, message: 'This catalog entry is referenced by CCT student or academic data. Update those links before removing it.' };
      if (pendingDelete.type === 'department') return await deleteDepartment(pendingDelete.name);
      if (pendingDelete.type === 'program') return await deleteProgram(pendingDelete.id);
      return await deleteSubjectFromCatalog(pendingDelete.id);
    }, () => `${pendingDelete.label} was removed from the active catalog.`);
    setPendingDelete(null);
  };

  const deleteTitle = pendingDelete?.type === 'department'
    ? 'Remove academic unit?'
    : pendingDelete?.type === 'program'
      ? 'Remove academic program?'
      : 'Remove subject?';

  const deleteMessage = pendingDelete?.type === 'department'
    ? `Remove "${pendingDelete?.label || ''}" from the CCT directory? Removal is blocked while accounts, records, programs, or subjects reference it.`
    : pendingDelete?.type === 'program'
      ? `Remove "${pendingDelete?.label || ''}" from the program directory? Linked subjects must be reassigned or removed first. Historical records remain intact.`
      : `Remove ${pendingDelete?.label || ''} from the subject catalog? Existing academic records remain unchanged.`;

  return (
    <div className="page-stack space-y-4 sm:space-y-6">
      <section className="hero-panel hero-motion relative overflow-hidden rounded-2xl border border-gold-500/30 bg-gradient-to-br from-slate-950 via-crimson-950 to-gold-950 p-5 text-white sm:p-6 lg:p-7 shadow-xl shadow-gold-950/40">
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-gold-500/25 blur-3xl" />
        <div className="absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-crimson-600/20 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-normal text-gold-400">
              <Sliders className="h-4 w-4" />
              CCT Configuration
            </div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">CCT Directory</h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gold-100/90 sm:text-sm">
              Keep academic units, programs, and subjects organized for consistent record encoding and reporting.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-gold-400/30 bg-crimson-900/40 px-3 py-1.5 text-xs font-bold text-gold-200">
                <Landmark className="h-3.5 w-3.5 text-gold-400" /> Units: {departments.length}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-gold-400/30 bg-crimson-900/40 px-3 py-1.5 text-xs font-bold text-gold-200">
                <BookOpen className="h-3.5 w-3.5 text-emerald-400" /> Subjects: {subjectCatalog.length}
              </span>
            </div>
          </div>

          {setActiveTab && (
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className="glass-control control-lift min-h-11 rounded-xl border border-gold-400/30 bg-crimson-950/40 px-4 text-sm font-bold text-gold-200 transition hover:bg-crimson-900/60 cursor-pointer flex items-center justify-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Return to Workspace
            </button>
          )}
        </div>
      </section>

      {permissions.isVPAA && (
        <section className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ['Academic units', departments.length, Building],
              ['Programs', programs.length, GraduationCap],
              ['Subjects', subjectCatalog.length, BookOpen],
              ['Pending writes', dataSync?.pendingWrites || 0, Database]
            ].map(([label, value, Icon]) => (
              <div key={label} className="surface-panel rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold tracking-normal text-slate-500 dark:text-slate-400">{label}</p>
                    <p className="mt-1 font-mono text-xl font-semibold text-slate-950 dark:text-white">{value}</p>
                  </div>
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-500/10 text-amber-500"><Icon className="h-4 w-4" /></span>
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <section className="surface-panel rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
              <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-crimson-500/10 text-crimson-500"><Layers className="h-4 w-4" /></span>
                <div>
                  <h2 className="text-sm font-semibold tracking-normal text-slate-900 dark:text-white">Academic Units</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Schools and units used in academic records and account assignments</p>
                </div>
              </div>
              <Message value={departmentMessage} />
              <form onSubmit={handleAddDepartment} className="mt-3 flex flex-col gap-4"><fieldset disabled={isSaving} className="contents">
                <label htmlFor="unit-name" className="form-label mb-0">Academic Unit Name</label>
                <input
                  id="unit-name"
                  required
                  value={newDepartmentName}
                  onChange={(event) => setNewDepartmentName(event.target.value)}
                  placeholder="New school or academic unit"
                  className="form-control flex-1"
                />
                <button type="submit" className="primary-action inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-crimson-600 px-4 text-sm font-bold text-white hover:bg-crimson-700">
                  <Plus className="h-4 w-4" /> Add Unit
                </button>
              </fieldset></form>
              <div className="mt-4 space-y-2">
                {departments.length ? departments.map((unit) => (
                  <div key={unit} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950/60">
                    <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                      <Building className="h-4 w-4 shrink-0 text-amber-500" />
                      <span className="truncate">{unit}</span>
                    </div>
                    <button type="button" disabled={isSaving} onClick={() => setPendingDelete({ type: 'department', name: unit, label: unit })} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40" aria-label={`Remove ${unit}`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )) : <EmptyState>Add your first academic unit to get started.</EmptyState>}
              </div>
            </section>

            <section className="surface-panel rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
              <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-gold-500/10 text-gold-500"><GraduationCap className="h-4 w-4" /></span>
                <div>
                  <h2 className="text-sm font-semibold tracking-normal text-slate-900 dark:text-white">Programs by Academic Unit</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Organize the programs offered by each academic unit</p>
                </div>
              </div>
              <Message value={programMessage} />
              <form onSubmit={handleAddProgram} className="mt-3 space-y-2"><fieldset disabled={isSaving} className="contents">
                <span className="form-label">Academic Unit</span>
                <CustomSelect
                  value={programDepartment}
                  onChange={setProgramDepartment}
                  options={departments.map((unit) => ({ value: unit, label: unit }))}
                  ariaLabel="Program academic unit"
                  placeholder="Select academic unit"
                />
                <div className="grid grid-cols-1 gap-4">
                  <label><span className="form-label">Program Code <span className="optional-label">(Optional)</span></span><input value={newProgramCode} onChange={(event) => setNewProgramCode(event.target.value)} placeholder="e.g. BSCS" className="form-control" /></label>
                  <label><span className="form-label">Program Name</span><input required value={newProgramName} onChange={(event) => setNewProgramName(event.target.value)} placeholder="e.g. Bachelor of Science in Computer Science" className="form-control" /></label>
                </div>
                <button type="submit" disabled={!programDepartment} className="primary-action inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gold-700 px-4 text-sm font-bold text-white hover:bg-gold-800 disabled:cursor-not-allowed disabled:opacity-50">
                  <Plus className="h-4 w-4" /> Add Program
                </button>
              </fieldset></form>
              <div className="mt-4 space-y-2">
                {programsForProgramForm.length ? programsForProgramForm.map((program) => (
                  <div key={program.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950/60">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {program.code && <span className="rounded-md bg-gold-500/10 px-2 py-0.5 font-mono text-xs font-semibold text-gold-700 dark:text-gold-300">{program.code}</span>}
                        <span className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">{program.name}</span>
                      </div>
                    </div>
                    <button type="button" disabled={isSaving} onClick={() => setPendingDelete({ type: 'program', id: program.id, label: program.name })} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40" aria-label={`Remove ${program.name}`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )) : <EmptyState>Select an academic unit and add its first program.</EmptyState>}
              </div>
            </section>
          </div>

          <section className="surface-panel rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
            <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/10 text-amber-500"><BookOpen className="h-5 w-5" /></span>
                <div>
                  <h2 className="text-sm font-semibold tracking-normal text-slate-900 dark:text-white">CCT Subject Catalog</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Subject codes and titles available for academic record encoding</p>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:w-[34rem]">
                <CustomSelect
                  value={catalogDepartment}
                  onChange={setCatalogDepartment}
                  options={[
                    { value: ALL_DEPARTMENTS, label: 'All academic units' },
                    ...departments.map((unit) => ({ value: unit, label: unit }))
                  ]}
                  ariaLabel="Catalog academic unit filter"
                />
                <CustomSelect
                  value={catalogProgram}
                  onChange={setCatalogProgram}
                  options={[
                    { value: ALL_PROGRAMS, label: 'All program scopes' },
                    { value: DEPARTMENT_WIDE, label: 'Department-wide only' },
                    ...catalogPrograms.map((program) => ({
                      value: program.id,
                      label: `${program.code ? `${program.code} — ` : ''}${program.name}`
                    }))
                  ]}
                  ariaLabel="Catalog program filter"
                />
              </div>
            </div>

            <Message value={subjectMessage} />

            <form onSubmit={handleAddSubject} className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/50 sm:p-4"><fieldset disabled={isSaving} className="contents">
              <div className="grid max-w-xl grid-cols-1 gap-4">
                <div>
                <span className="form-label">Academic Unit</span>
                <CustomSelect
                  value={subjectDepartment}
                  onChange={setSubjectDepartment}
                  options={departments.map((unit) => ({ value: unit, label: unit }))}
                  ariaLabel="Subject academic unit"
                  placeholder="Select academic unit"
                />
                </div>
                <div>
                <span className="form-label">Program Scope <span className="optional-label">(Optional)</span></span>
                <CustomSelect
                  value={subjectProgram}
                  onChange={setSubjectProgram}
                  options={[
                    { value: DEPARTMENT_WIDE, label: 'Department-wide subject' },
                    ...programsForSubject.map((program) => ({ value: program.id, label: `${program.code ? `${program.code} — ` : ''}${program.name}` }))
                  ]}
                  ariaLabel="Subject program"
                />
                </div>
                <label><span className="form-label">Subject Code</span><input required value={newSubjectCode} onChange={(event) => setNewSubjectCode(event.target.value)} placeholder="e.g. CS101" className="form-control" /></label>
                <label><span className="form-label">Subject Title</span><input required value={newSubjectTitle} onChange={(event) => setNewSubjectTitle(event.target.value)} placeholder="e.g. Introduction to Computing" className="form-control" /></label>
                <button type="submit" disabled={!subjectDepartment} className="primary-action inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-amber-700 px-4 text-sm font-bold text-white hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-50">
                  <Plus className="h-4 w-4" /> Add Subject
                </button>
              </div>
            </fieldset></form>

            <div className="mt-4 space-y-4">
              {Object.values(subjectGroups).length ? Object.entries(subjectGroups).map(([key, group]) => (
                <section key={key} className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
                  <div className="flex flex-col gap-1 bg-slate-100 px-4 py-3 dark:bg-slate-800/70 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{group.programName}</p>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">{group.department}</p>
                    </div>
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{group.subjects.length} subject{group.subjects.length === 1 ? '' : 's'}</span>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {group.subjects.map((subject) => (
                      <div key={subject.id} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-950/40">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 font-mono text-xs font-semibold text-amber-700 dark:text-amber-300">{subject.code}</span>
                            <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{subject.title}</span>
                          </div>
                        </div>
                        <button type="button" disabled={isSaving} onClick={() => setPendingDelete({ type: 'subject', id: subject.id, label: `${subject.code} — ${subject.title}` })} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40" aria-label={`Remove ${subject.code}`}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )) : <EmptyState>No subjects match the selected database scope.</EmptyState>}
            </div>
          </section>
        </section>
      )}

      <ConfirmDialog open={Boolean(pendingDelete)} title={deleteTitle} message={deleteMessage} confirmLabel="Remove" busy={isSaving} onConfirm={confirmDelete} onCancel={() => !isSaving && setPendingDelete(null)} />
    </div>
  );
};
