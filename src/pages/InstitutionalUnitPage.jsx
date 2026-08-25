import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
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
    <div className={`flex items-start gap-2 rounded-xl border p-3 text-xs ${isError
        ? 'border-rose-800 bg-rose-950/70 text-rose-200'
        : 'border-emerald-800 bg-emerald-950/70 text-emerald-200'
      }`}>
      {isError ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
      <span>{value.text}</span>
    </div>
  );
};

const EmptyState = ({ children }) => (
  <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-xs text-slate-400 dark:border-slate-700">
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

  const [pendingDelete, setPendingDelete] = useState(null);

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

  const handleAddDepartment = (event) => {
    event.preventDefault();
    setDepartmentMessage(null);
    const result = addDepartment(newDepartmentName);
    if (!result?.success) {
      setDepartmentMessage({ type: 'error', text: result?.message });
      return;
    }
    setNewDepartmentName('');
    setDepartmentMessage({ type: 'success', text: `Academic unit "${result.department}" was queued for database synchronization.` });
  };

  const handleAddProgram = (event) => {
    event.preventDefault();
    setProgramMessage(null);
    const result = addProgram({
      code: newProgramCode,
      name: newProgramName,
      department: programDepartment
    });
    if (!result?.success) {
      setProgramMessage({ type: 'error', text: result?.message });
      return;
    }
    setNewProgramCode('');
    setNewProgramName('');
    setProgramMessage({ type: 'success', text: `Program "${result.program.name}" was added from the live database model.` });
  };

  const handleAddSubject = (event) => {
    event.preventDefault();
    setSubjectMessage(null);
    const result = addSubjectToCatalog({
      code: newSubjectCode,
      title: newSubjectTitle,
      department: subjectDepartment,
      programId: subjectProgram === DEPARTMENT_WIDE ? '' : subjectProgram
    });
    if (!result?.success) {
      setSubjectMessage({ type: 'error', text: result?.message });
      return;
    }
    setNewSubjectCode('');
    setNewSubjectTitle('');
    setSubjectMessage({ type: 'success', text: `Subject ${result.subject.code} was added to ${result.subject.programName || 'the department-wide catalog'}.` });
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    let result;
    if (pendingDelete.type === 'department') result = deleteDepartment(pendingDelete.name);
    if (pendingDelete.type === 'program') result = deleteProgram(pendingDelete.id);
    if (pendingDelete.type === 'subject') result = deleteSubjectFromCatalog(pendingDelete.id);

    const setter = pendingDelete.type === 'department'
      ? setDepartmentMessage
      : pendingDelete.type === 'program'
        ? setProgramMessage
        : setSubjectMessage;
    setter(result?.success
      ? { type: 'success', text: `${pendingDelete.label} was removed from the active catalog.` }
      : { type: 'error', text: result?.message || `${pendingDelete.label} could not be removed.` });
    setPendingDelete(null);
  };

  const deleteTitle = pendingDelete?.type === 'department'
    ? 'Remove academic unit?'
    : pendingDelete?.type === 'program'
      ? 'Remove academic program?'
      : 'Remove subject?';

  const deleteMessage = pendingDelete?.type === 'department'
    ? `Remove "${pendingDelete?.label || ''}" from the institutional directory? Removal is blocked while accounts, records, programs, or subjects reference it.`
    : pendingDelete?.type === 'program'
      ? `Remove "${pendingDelete?.label || ''}" from the program directory? Linked subjects must be reassigned or removed first. Historical records remain intact.`
      : `Remove ${pendingDelete?.label || ''} from the subject catalog? Existing academic records remain unchanged.`;

  return (
    <div className="page-stack space-y-4 sm:space-y-6">
      <section className="hero-panel hero-motion relative overflow-hidden rounded-3xl border border-sky-500/30 bg-gradient-to-br from-slate-950 via-blue-950 to-sky-950 p-5 text-white sm:p-6 lg:p-7 shadow-xl shadow-sky-950/40">
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-sky-500/25 blur-3xl" />
        <div className="absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-blue-600/20 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-sky-400">
              <Sliders className="h-4 w-4" />
              Database-driven configuration
            </div>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Institutional Unit</h1>
            <p className="mt-2 max-w-3xl text-xs leading-relaxed text-sky-100/90 sm:text-sm">
              Maintain the department → program → subject hierarchy directly in Firebase. The interface renders cached components first, then synchronizes database changes in the background.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/30 bg-blue-900/40 px-3 py-1.5 text-[10px] font-bold text-sky-200">
                <Landmark className="h-3.5 w-3.5 text-sky-400" /> Units: {departments.length}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/30 bg-blue-900/40 px-3 py-1.5 text-[10px] font-bold text-sky-200">
                <BookOpen className="h-3.5 w-3.5 text-emerald-400" /> Subjects: {subjectCatalog.length}
              </span>
            </div>
          </div>

          {setActiveTab && (
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className="glass-control control-lift min-h-11 rounded-xl border border-sky-400/30 bg-blue-950/40 px-4 text-xs font-bold text-sky-200 transition hover:bg-blue-900/60 cursor-pointer flex items-center justify-center gap-2"
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
                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
                    <p className="mt-1 font-mono text-xl font-black text-slate-950 dark:text-white">{value}</p>
                  </div>
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-500/10 text-amber-500"><Icon className="h-4 w-4" /></span>
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <section className="surface-panel rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
              <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-500/10 text-violet-500"><Layers className="h-4 w-4" /></span>
                <div>
                  <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">Academic units</h2>
                  <p className="text-[10px] text-slate-500">Loaded from the Firebase departments collection</p>
                </div>
              </div>
              <Message value={departmentMessage} />
              <form onSubmit={handleAddDepartment} className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  required
                  value={newDepartmentName}
                  onChange={(event) => setNewDepartmentName(event.target.value)}
                  placeholder="New school or academic unit"
                  className="form-control flex-1"
                />
                <button type="submit" className="primary-action inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-xs font-bold text-white hover:bg-violet-700">
                  <Plus className="h-4 w-4" /> Add unit
                </button>
              </form>
              <div className="mt-4 space-y-2">
                {departments.length ? departments.map((unit) => (
                  <div key={unit} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950/60">
                    <div className="flex min-w-0 items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
                      <Building className="h-4 w-4 shrink-0 text-amber-500" />
                      <span className="truncate">{unit}</span>
                    </div>
                    <button type="button" onClick={() => setPendingDelete({ type: 'department', name: unit, label: unit })} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40" aria-label={`Remove ${unit}`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )) : <EmptyState>No departments exist in Firebase yet.</EmptyState>}
              </div>
            </section>

            <section className="surface-panel rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
              <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-sky-500/10 text-sky-500"><GraduationCap className="h-4 w-4" /></span>
                <div>
                  <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">Programs by academic unit</h2>
                  <p className="text-[10px] text-slate-500">Every program is read from and maintained in the Firebase programs collection</p>
                </div>
              </div>
              <Message value={programMessage} />
              <form onSubmit={handleAddProgram} className="mt-3 space-y-2">
                <CustomSelect
                  value={programDepartment}
                  onChange={setProgramDepartment}
                  options={departments.map((unit) => ({ value: unit, label: unit }))}
                  ariaLabel="Program academic unit"
                  placeholder="Select academic unit"
                />
                <div className="grid gap-2 sm:grid-cols-[minmax(8rem,0.35fr)_minmax(0,1fr)]">
                  <input value={newProgramCode} onChange={(event) => setNewProgramCode(event.target.value)} placeholder="Program code (optional)" className="form-control" />
                  <input required value={newProgramName} onChange={(event) => setNewProgramName(event.target.value)} placeholder="Program name" className="form-control" />
                </div>
                <button type="submit" disabled={!programDepartment} className="primary-action inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 text-xs font-bold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50">
                  <Plus className="h-4 w-4" /> Add program
                </button>
              </form>
              <div className="mt-4 space-y-2">
                {programsForProgramForm.length ? programsForProgramForm.map((program) => (
                  <div key={program.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950/60">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {program.code && <span className="rounded-md bg-sky-500/10 px-2 py-0.5 font-mono text-[10px] font-black text-sky-600 dark:text-sky-300">{program.code}</span>}
                        <span className="truncate text-xs font-bold text-slate-800 dark:text-slate-100">{program.name}</span>
                      </div>
                    </div>
                    <button type="button" onClick={() => setPendingDelete({ type: 'program', id: program.id, label: program.name })} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40" aria-label={`Remove ${program.name}`}>
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
                  <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">Institutional Subject Catalog</h2>
                  <p className="text-[10px] text-slate-500">Subjects inherit their academic unit and optionally belong to one database program</p>
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

            <form onSubmit={handleAddSubject} className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/50 sm:p-4">
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(13rem,1.2fr)_minmax(12rem,1fr)_minmax(9rem,0.55fr)_minmax(14rem,1.2fr)_auto]">
                <CustomSelect
                  value={subjectDepartment}
                  onChange={setSubjectDepartment}
                  options={departments.map((unit) => ({ value: unit, label: unit }))}
                  ariaLabel="Subject academic unit"
                  placeholder="Select academic unit"
                />
                <CustomSelect
                  value={subjectProgram}
                  onChange={setSubjectProgram}
                  options={[
                    { value: DEPARTMENT_WIDE, label: 'Department-wide subject' },
                    ...programsForSubject.map((program) => ({ value: program.id, label: `${program.code ? `${program.code} — ` : ''}${program.name}` }))
                  ]}
                  ariaLabel="Subject program"
                />
                <input required value={newSubjectCode} onChange={(event) => setNewSubjectCode(event.target.value)} placeholder="Subject code" className="form-control" />
                <input required value={newSubjectTitle} onChange={(event) => setNewSubjectTitle(event.target.value)} placeholder="Subject title" className="form-control" />
                <button type="submit" disabled={!subjectDepartment} className="primary-action inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 text-xs font-bold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50">
                  <Plus className="h-4 w-4" /> Add subject
                </button>
              </div>
            </form>

            <div className="mt-4 space-y-4">
              {Object.values(subjectGroups).length ? Object.entries(subjectGroups).map(([key, group]) => (
                <section key={key} className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
                  <div className="flex flex-col gap-1 bg-slate-100 px-4 py-3 dark:bg-slate-800/70 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-black text-slate-900 dark:text-white">{group.programName}</p>
                      <p className="truncate text-[10px] text-slate-500 dark:text-slate-400">{group.department}</p>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400">{group.subjects.length} subject{group.subjects.length === 1 ? '' : 's'}</span>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {group.subjects.map((subject) => (
                      <div key={subject.id} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-950/40">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] font-black text-amber-700 dark:text-amber-300">{subject.code}</span>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{subject.title}</span>
                          </div>
                        </div>
                        <button type="button" onClick={() => setPendingDelete({ type: 'subject', id: subject.id, label: `${subject.code} — ${subject.title}` })} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40" aria-label={`Remove ${subject.code}`}>
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

      <ConfirmDialog open={Boolean(pendingDelete)} title={deleteTitle} message={deleteMessage} confirmLabel="Remove" onConfirm={confirmDelete} onCancel={() => setPendingDelete(null)} />
    </div>
  );
};
