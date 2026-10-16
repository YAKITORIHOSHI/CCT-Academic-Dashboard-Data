import { useMemo, useState } from 'react';
import { Download, Edit3, Plus, Search, ShieldCheck, Trash2, X } from 'lucide-react';
import { useAuth } from '../context/auth';
import { useAcademicData } from '../context/academicData';
import { buildAcademicYearOptions, getCurrentAcademicYear } from '../utils/academic';
import { GLOBAL_COLLECTIONS, MOVEMENTS, STUDENT_STATUSES, YEAR_LEVELS } from '../utils/academicModules';
import { csvCell } from '../utils/csv';
import { CustomSelect } from '../components/common/CustomSelect';
import { Modal } from '../components/common/Modal';
import { ConfirmDialog, Toast } from '../components/common/Feedback';
import { AggregateChart } from '../components/common/AggregateChart';
import { firebaseErrorMessage } from '../services/firebaseSafety';

const screens = {
  students: { title: 'CCT Student Records', description: 'Find a student’s academic status, year level, program, and current subjects.', singular: 'Student' },
  annualReports: { title: 'CCT Annual Academic Reports', description: 'One college-wide submission per Academic Year, with year-level enrollment counts and a verified total.', singular: 'Annual Report' },
  retention: { title: 'CCT Retention and Student Movement', description: 'Track retention, shiftees, and transferees together, with sections labelled by Academic Year.', singular: 'Retention Entry' },
  faculty: { title: 'CCT Faculty Performance', description: 'Review faculty performance and see the assigned Department Head for each CCT school.', singular: 'Faculty Performance Entry' },
  achievements: { title: 'CCT School Achievements', description: 'Achievements organized by CCT school.', singular: 'School Achievement' },
  topcit: { title: 'CCT TOPCIT Participation and Levels', description: 'Count students who took TOPCIT and record their achieved certificate levels for each Academic Year.', singular: 'TOPCIT Annual Summary' }
};
const blank = (collection, department, academicYear) => ({ department, academicYear, yearLevel: 1, status: 'Enrolled', movement: 'Retained', rating: '3',
  name: '', studentNumber: '', staffNumber: '', programId: '', subjectIds: {}, notes: '', studentId: '', sectionId: '', facultyId: '', destination: '', title: '', description: '', achievedOn: '',
  ...(GLOBAL_COLLECTIONS.includes(collection) ? Object.fromEntries([1,2,3,4,5].map((i) => [(collection === 'annualReports' ? 'year' : 'level') + i, '0'])) : {}) });
function Input({ label, value = '', onChange, type = 'text', optional = false, ...props }) {
  return <label className="block"><span className="form-label mb-2 block">{label}{optional && <span className="optional-label"> (Optional)</span>}</span><input className="form-control w-full px-3" type={type} value={value} onChange={(event) => onChange(event.target.value)} required={!optional} {...props} /></label>;
}
function Select({ label, value, onChange, options, disabled = false }) {
  return <div><p className="form-label mb-2">{label}</p><CustomSelect ariaLabel={label} value={value} onChange={onChange} options={options} disabled={disabled} /></div>;
}
function Notes({ value = '', onChange, label = 'Notes' }) {
  return <label className="block"><span className="form-label mb-2 block">{label} <span className="optional-label">(Optional)</span></span><textarea className="form-control w-full px-3" rows={3} value={value} maxLength={2000} placeholder="Add relevant academic context" onChange={(event) => onChange(event.target.value)} /></label>;
}
export function AcademicWorkspacePage({ module }) {
  const { currentUser, departments, programs, subjectCatalog, permissions } = useAuth();
  const data = useAcademicData();
  const config = screens[module];
  const [search, setSearch] = useState(''); const [year, setYear] = useState('ALL'); const [yearLevel, setYearLevel] = useState('ALL');
  const [school, setSchool] = useState('ALL'); const [sectionFilter, setSectionFilter] = useState('ALL'); const [movementFilter, setMovementFilter] = useState('ALL');
  const [page, setPage] = useState(0); const [editor, setEditor] = useState(null); const [form, setForm] = useState({});
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [notice, setNotice] = useState(null); const [deleting, setDeleting] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const rows = data[module] || [];
  const schools = permissions.canViewAllDepartments ? departments : departments.filter((item) => item === currentUser.department);
  const canWrite = !permissions.isPresident && (!GLOBAL_COLLECTIONS.includes(module) || permissions.isVPAA) && (module !== 'faculty' || permissions.isDean || permissions.isVPAA);
  const canAssignHead = permissions.isVPAA || permissions.isDean;
  const canEdit = (row) => canWrite && (!permissions.isHead || row.createdByUid === currentUser.uid);
  const years = buildAcademicYearOptions([...rows, ...data.sections]);
  const studentById = useMemo(() => Object.fromEntries(data.students.map((student) => [student.id, student])), [data.students]);
  const sectionById = useMemo(() => Object.fromEntries(data.sections.map((section) => [section.id, section])), [data.sections]);
  const subjectById = useMemo(() => Object.fromEntries(subjectCatalog.map((subject) => [subject.id, subject])), [subjectCatalog]);
  const filtered = rows.filter((row) => {
    const student = studentById[row.studentId];
    const term = [row.name, row.title, row.studentNumber, row.staffNumber, row.department, row.movement, student?.name, student?.studentNumber].join(' ').toLowerCase();
    return term.includes(search.toLowerCase().trim()) && (year === 'ALL' || row.academicYear === year)
      && (school === 'ALL' || row.department === school) && (GLOBAL_COLLECTIONS.includes(module) || yearLevel === 'ALL' || String(row.yearLevel || student?.yearLevel) === yearLevel)
      && (sectionFilter === 'ALL' || row.sectionId === sectionFilter) && (movementFilter === 'ALL' || row.movement === movementFilter);
  }).sort((a,b) => String(b.academicYear || '').localeCompare(String(a.academicYear || '')) || String(a.name || a.title || '').localeCompare(String(b.name || b.title || '')));
  const visible = filtered.slice(page * 20, page * 20 + 20);
  const changeFilter = (setter) => (value) => { setter(value); setPage(0); };
  const open = (collection = module, original = null, department = '') => {
    setError(''); setEditor({ collection, original });
    setForm(original ? structuredClone(original) : blank(collection, department || schools[0] || currentUser.department, year === 'ALL' ? getCurrentAcademicYear() : year));
  };
  const field = (name) => (value) => setForm((previous) => ({ ...previous, [name]: value }));
  const save = async (event) => {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError('');
    try {
      const result = await data.saveAcademic(editor.collection, form, editor.original);
      if (!result?.success) { setError(result?.message || 'The CCT entry could not be saved.'); return; }
      setEditor(null); setNotice({ type: 'success', message: 'CCT entry saved and synchronized.' });
    } catch (failure) { setError(firebaseErrorMessage(failure, 'save')); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (busy) return; setBusy(true);
    try {
      const result = await data.saveAcademic(module, deleting, deleting, true);
      if (result?.success) { setDeleting(null); setNotice({ type: 'success', message: 'CCT entry removed.' }); }
      else setNotice({ type: 'error', message: result?.message || 'The CCT entry could not be removed.' });
    } catch (failure) { setNotice({ type: 'error', message: firebaseErrorMessage(failure, 'remove') }); }
    finally { setBusy(false); }
  };
  const exportRows = () => {
    const columns = module === 'students' ? ['studentNumber','name','department','academicYear','yearLevel','status']
      : module === 'annualReports' ? ['academicYear','year1','year2','year3','year4','year5','total']
      : module === 'topcit' ? ['academicYear','level1','level2','level3','level4','level5','total']
      : module === 'retention' ? ['academicYear','department','studentId','sectionId','movement','destination']
      : module === 'faculty' ? ['academicYear','department','staffNumber','name','rating'] : ['academicYear','department','title','description','achievedOn'];
    const content = [columns.map(csvCell).join(','), ...filtered.map((row) => columns.map((column) => csvCell(row[column])).join(','))].join('\n');
    const url = URL.createObjectURL(new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `CCT_${module}_${year}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const selectedAnnual = filtered[0];
  const summaryPrefix = module === 'annualReports' ? 'year' : 'level';
  const summaryCounts = [1,2,3,4,5].map((i) => ({ label: module === 'annualReports' ? YEAR_LEVELS[i-1] : `Level ${i}`, value: filtered.reduce((sum, row) => sum + Number(row[summaryPrefix+i] || 0), 0) }));
  const selectedSectionOptions = data.sections.filter((section) => (year === 'ALL' || section.academicYear === year) && (school === 'ALL' || section.department === school)).map((section) => ({ value: section.id, label: `${section.name} · ${section.academicYear} · ${section.department}` }));
  const col = editor?.collection;
  const formStudents = data.students.filter((student) => student.department === form.department);
  const formSections = data.sections.filter((section) => section.department === form.department && section.academicYear === form.academicYear);
  const formSubjects = subjectCatalog.filter((subject) => subject.department === form.department && (!form.programId || !subject.programId || subject.programId === form.programId));
  const readOnlyIdentity = Boolean(editor?.original);
  if (permissions.isPresident && module === 'students') return <p className="empty-work">Individual CCT student records are restricted to authorized academic personnel.</p>;
  if (permissions.isPresident && module === 'retention') return <p className="empty-work">Individual CCT retention records are restricted to authorized academic personnel.</p>;
  return <div className="page-stack space-y-6">
    <header className="workspace-heading flex flex-wrap items-start justify-between gap-5"><div><h1 className="workspace-title">{config.title}</h1><p className="workspace-subtitle">{config.description}</p></div>
      <div className="overview-actions"><button className="control-lift inline-flex items-center gap-2" onClick={exportRows} disabled={!filtered.length}><Download className="h-4 w-4" />Export CSV</button>
        {canWrite && <button className="primary-action inline-flex items-center gap-2" onClick={() => open()} disabled={data.sync.loading || Boolean(data.sync.error)}><Plus className="h-4 w-4" />Add {config.singular}</button>}</div>
    </header>
    {data.sync.error && <p role="alert" className="login-alert">{data.sync.error}</p>}
    {data.sync.loading && <p role="status" className="muted-copy">Loading verified CCT records…</p>}
    <section className="surface-panel p-5 space-y-4" aria-label="Search and filters">
      {!GLOBAL_COLLECTIONS.includes(module) && <label className="relative block"><Search className="absolute left-3 top-3.5 h-4 w-4" /><input type="search" className="form-control w-full pl-10 pr-3" aria-label={`Search ${config.title}`} placeholder={module === 'students' ? 'Search student name or student number' : 'Search names, numbers, or titles'} value={search} onChange={(event) => changeFilter(setSearch)(event.target.value)} /></label>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Select label="Academic Year" value={year} onChange={changeFilter(setYear)} options={[{value:'ALL',label:'All Academic Years'},...years]} />
        {!GLOBAL_COLLECTIONS.includes(module) && <Select label="CCT School" value={school} onChange={changeFilter(setSchool)} options={[{value:'ALL',label:'All Authorized Schools'},...schools]} />}
        {module === 'students' && <Select label="Year Level" value={yearLevel} onChange={changeFilter(setYearLevel)} options={[{value:'ALL',label:'All Year Levels'},...YEAR_LEVELS.map((label,i) => ({value:String(i+1),label}))]} />}
        {module === 'annualReports' && <Select label="Year Level" value={yearLevel} onChange={changeFilter(setYearLevel)} options={[{value:'ALL',label:'All Year Levels'},...YEAR_LEVELS.map((label,i) => ({value:String(i+1),label}))]} />}
        {module === 'retention' && <><Select label="Section and Academic Year" value={sectionFilter} onChange={changeFilter(setSectionFilter)} options={[{value:'ALL',label:'All Sections'},...selectedSectionOptions]} /><Select label="Retention / Movement" value={movementFilter} onChange={changeFilter(setMovementFilter)} options={[{value:'ALL',label:'All Student Movements'},...MOVEMENTS]} /></>}
      </div>
      {module === 'retention' && canWrite && <button className="control-lift" onClick={() => open('sections')}>Manage / Add Section</button>}
    </section>
    {GLOBAL_COLLECTIONS.includes(module) && <>
      <section className="grid gap-6 lg:grid-cols-[1fr_1.5fr]"><article className="surface-panel p-6"><p className="muted-copy">{module === 'annualReports' ? 'Reported Student Enrollment' : 'Students Who Took TOPCIT'}</p><p className="metric-value text-4xl font-semibold mt-3">{summaryCounts.reduce((sum,item) => sum+item.value,0).toLocaleString()}</p><p className="muted-copy mt-3">{year === 'ALL' ? 'Across selected annual submissions. A student can appear in multiple Academic Years.' : year}</p></article>
        <AggregateChart hasData={filtered.length > 0} title={module === 'annualReports' ? 'Student Enrollment by Year Level' : 'TOPCIT Achieved Levels'} description={module === 'annualReports' ? 'One annual report per Academic Year. The total is calculated from these counts.' : 'Use the achieved level printed on each student’s TOPCIT certificate; count each participant once in the annual summary.'} items={module === 'annualReports' && yearLevel !== 'ALL' ? summaryCounts.filter((_,i) => String(i+1) === yearLevel) : summaryCounts} />
      </section>
      {module === 'annualReports' && selectedAnnual && <p className="muted-copy">{yearLevel === 'ALL' ? 'All year levels' : YEAR_LEVELS[Number(yearLevel)-1]}: {summaryCounts.filter((_,i) => yearLevel === 'ALL' || String(i+1) === yearLevel).reduce((sum,item) => sum+item.value,0).toLocaleString()} students. College-wide total: {summaryCounts.reduce((sum,item) => sum+item.value,0).toLocaleString()}.</p>}
    </>}
    {module === 'faculty' && <section className="grid gap-5 md:grid-cols-2">{schools.map((department) => {
      const assignment = data.departmentHeads.find((item) => item.department === department); const head = data.faculty.find((item) => item.id === assignment?.facultyId);
      return <article className="surface-panel p-5" key={department}><p className="muted-copy">{department}</p><h2 className="section-heading mt-2">Department Head: {head?.name || 'Not Assigned'}</h2>{head && <p className="muted-copy">Faculty No. {head.staffNumber}</p>}
        {canAssignHead && <button className="control-lift mt-4" onClick={() => open('departmentHeads', assignment || null, department)}>Assign Department Head</button>}</article>;
    })}</section>}
    {module === 'achievements' ? <section className="space-y-6">{schools.filter((department) => school === 'ALL' || school === department).map((department) => <article className="surface-panel p-6" key={department}>
      <h2 className="section-heading">{department}</h2><div className="mt-4 space-y-4">{filtered.filter((row) => row.department === department).length ? filtered.filter((row) => row.department === department).map((row) => <div key={row.id} className="inset-panel rounded-xl p-4"><h3 className="font-semibold">{row.title}</h3><p className="muted-copy">{row.academicYear}{row.achievedOn && ` · ${row.achievedOn}`}</p><p className="text-sm mt-2 whitespace-pre-wrap">{row.description}</p>{canEdit(row) && <div className="flex gap-3 mt-3"><button className="control-lift" onClick={() => open(module,row)}>Edit</button><button className="control-lift" onClick={() => setDeleting(row)}>Delete</button></div>}</div>) : <p className="muted-copy">No achievements submitted for this school.</p>}</div>
    </article>)}</section> : <section className="space-y-4" aria-label={`${config.title} results`}>
      <p className="muted-copy">{filtered.length} matching {filtered.length === 1 ? 'entry' : 'entries'}</p>
      {!visible.length && !data.sync.loading && <p className="empty-work">No entries match these filters. {canWrite ? 'Use Add to create the first CCT entry.' : 'No CCT entries have been shared yet.'}</p>}
      {visible.map((row) => {
        const student = module === 'students' ? row : studentById[row.studentId]; const section = sectionById[row.sectionId];
        const label = GLOBAL_COLLECTIONS.includes(module) ? row.academicYear : row.name || student?.name || 'CCT Entry';
        return <article className="surface-panel p-5" key={row.id}><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="section-heading">{label}</h2><p className="muted-copy">{row.department}{row.department && ' · '}{row.academicYear}</p>
          {module === 'students' && <p className="text-sm mt-2">Student No. {row.studentNumber} · {YEAR_LEVELS[row.yearLevel-1]} · <strong>{row.status}</strong></p>}
          {module === 'retention' && <><p className="text-sm mt-2">{student?.studentNumber || 'Student unavailable'} · {row.movement}</p><p className="muted-copy">Section: {section ? `${section.name} · ${section.academicYear}` : 'Section unavailable'}{row.destination && ` · Destination: ${row.destination}`}</p></>}
          {module === 'faculty' && <p className="text-sm mt-2">Faculty No. {row.staffNumber} · Performance Rating: {Number(row.rating).toFixed(2)} / 5.00</p>}
          {GLOBAL_COLLECTIONS.includes(module) && <p className="text-sm mt-2">Total: {Number(row.total).toLocaleString()} {module === 'topcit' ? 'participants' : 'students'}</p>}
        </div><div className="flex flex-wrap gap-2">{module === 'students' && <button className="control-lift" onClick={() => setExpanded(expanded === row.id ? null : row.id)} aria-expanded={expanded === row.id}>Academic Details</button>}
          {canEdit(row) && <><button className="control-lift inline-flex items-center gap-2" onClick={() => open(module,row)}><Edit3 className="h-4 w-4" />Edit</button>{module !== 'students' && <button className="control-lift inline-flex items-center gap-2" onClick={() => setDeleting(row)}><Trash2 className="h-4 w-4" />Delete</button>}</>}
        </div></div>
        {module === 'students' && expanded === row.id && <div className="inset-panel rounded-xl p-5 mt-5 space-y-3"><p className="text-sm"><strong>Program:</strong> {programs.find((program) => program.id === row.programId)?.name || 'No program assigned'}</p><h3 className="font-semibold text-sm">Currently Taking</h3>
          {Object.keys(row.subjectIds || {}).length ? <ul className="space-y-2">{Object.keys(row.subjectIds).map((id) => <li className="text-sm" key={id}>{subjectById[id] ? `${subjectById[id].code} — ${subjectById[id].title}` : 'Subject no longer in catalog'}</li>)}</ul> : <p className="muted-copy">No current subjects assigned.</p>}
          <h3 className="font-semibold text-sm">Retention and Movement History</h3>{data.retention.filter((item) => item.studentId === row.id).map((item) => <p key={item.id} className="muted-copy">{item.academicYear} · {item.movement} · {sectionById[item.sectionId]?.name || 'Section unavailable'}</p>)}{row.notes && <p className="text-sm whitespace-pre-wrap">{row.notes}</p>}
        </div>}
        {GLOBAL_COLLECTIONS.includes(module) && <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4 text-sm">{[1,2,3,4,5].filter((i) => module !== 'annualReports' || yearLevel === 'ALL' || yearLevel === String(i)).map((i) => <span key={i}>{module === 'annualReports' ? YEAR_LEVELS[i-1] : `Level ${i}`}: <strong>{row[summaryPrefix+i]}</strong></span>)}</div>}
        {module !== 'students' && row.notes && <p className="muted-copy mt-3 whitespace-pre-wrap">{row.notes}</p>}
      </article>;
      })}
      {filtered.length > 20 && <div className="flex items-center justify-between"><button className="control-lift" disabled={!page} onClick={() => setPage(page-1)}>Previous</button><p className="muted-copy">Page {page+1} of {Math.ceil(filtered.length/20)}</p><button className="control-lift" disabled={(page+1)*20 >= filtered.length} onClick={() => setPage(page+1)}>Next</button></div>}
    </section>}
    {module === 'retention' && data.sections.length > 0 && <section className="surface-panel p-6"><h2 className="section-heading">CCT Sections and Academic Years</h2><div className="mt-4 space-y-3">{data.sections.filter((item) => year === 'ALL' || item.academicYear === year).map((item) => <div className="flex justify-between gap-4 text-sm" key={item.id}><span>{item.name} · {item.academicYear} · {YEAR_LEVELS[item.yearLevel-1]} · {item.department}</span>{canEdit(item) && <button className="control-lift" onClick={() => open('sections',item)}>Edit Section</button>}</div>)}</div></section>}
    <Modal open={Boolean(editor)} className="w-full max-w-xl" onClose={() => !busy && setEditor(null)} ariaLabel={`CCT ${editor?.original ? 'Edit' : 'New'} ${col === 'sections' ? 'Section' : col === 'departmentHeads' ? 'Department Head Assignment' : config.singular}`} closeOnBackdrop={!busy}>
      <form onSubmit={save} className="p-6 w-full max-w-xl mx-auto space-y-5"><div className="flex justify-between gap-4"><h2 className="section-heading">{editor?.original ? 'Edit' : 'New'} {col === 'sections' ? 'CCT Section' : col === 'departmentHeads' ? 'CCT Department Head Assignment' : config.singular}</h2><button type="button" disabled={busy} onClick={() => setEditor(null)} aria-label="Close entry form"><X className="h-5 w-5" /></button></div>
        {error && <p className="login-alert" role="alert">{error}</p>}
        {!GLOBAL_COLLECTIONS.includes(col) && <Select label="CCT School" value={form.department} disabled={readOnlyIdentity || !permissions.isVPAA} options={schools} onChange={(value) => setForm((previous) => ({ ...previous, department:value, studentId:'', sectionId:'', programId:'', subjectIds:{}, facultyId:'' }))} />}
        {col !== 'departmentHeads' && <Select label="Academic Year" value={form.academicYear} disabled={readOnlyIdentity && col !== 'students'} options={years} onChange={(value) => setForm((previous) => ({...previous, academicYear:value, sectionId:''}))} />}
        {GLOBAL_COLLECTIONS.includes(col) && <>
          <p className="muted-copy">One submission per Academic Year. Edit an existing submission to revise its counts.</p>
          {[1,2,3,4,5].map((i) => <Input key={i} type="number" label={col === 'annualReports' ? `${YEAR_LEVELS[i-1]} Students` : `Level ${i} Participants`} min={0} max={100000} step={1} value={form[(col === 'annualReports' ? 'year' : 'level')+i]} onChange={field((col === 'annualReports' ? 'year' : 'level')+i)} />)}
          <p className="inset-panel p-4 rounded-xl font-semibold">Calculated Total: {[1,2,3,4,5].reduce((sum,i) => sum+(Number(form[(col === 'annualReports' ? 'year' : 'level')+i]) || 0),0).toLocaleString()}</p>
          {col === 'annualReports' && <button type="button" className="control-lift" onClick={() => { const counts={}; for(let i=1;i<=5;i++) counts['year'+i]=data.students.filter((student) => student.academicYear===form.academicYear && student.status==='Enrolled' && Number(student.yearLevel)===i).length; setForm((previous)=>({...previous,...counts})); }}>Fill From Current CCT Student Records</button>}
        </>}
        {col === 'students' && <><Input label="Student Number" value={form.studentNumber} onChange={field('studentNumber')} maxLength={40} disabled={readOnlyIdentity} /><Input label="Student Name" value={form.name} onChange={field('name')} maxLength={100} />
          <Select label="Year Level" value={String(form.yearLevel)} options={YEAR_LEVELS.map((label,i)=>({value:String(i+1),label}))} onChange={field('yearLevel')} />
          <Select label="Academic Status" value={form.status} options={STUDENT_STATUSES} onChange={field('status')} />
          <Select label="CCT Program (Optional)" value={form.programId} onChange={(value) => setForm((previous)=>({...previous,programId:value,subjectIds:{}}))} options={[{value:'',label:'No Program Assigned'},...programs.filter((program)=>program.department===form.department).map((program)=>({value:program.id,label:program.name}))]} />
          <fieldset className="inset-panel p-4 rounded-xl"><legend className="form-label px-1">Currently Taking (Optional)</legend><div className="max-h-56 overflow-y-auto space-y-3">{formSubjects.length ? formSubjects.map((subject)=><label key={subject.id} className="flex items-start gap-3 text-sm"><input type="checkbox" className="login-check mt-1" checked={Boolean(form.subjectIds?.[subject.id])} onChange={(event)=>setForm((previous)=>{const subjectIds={...previous.subjectIds};if(event.target.checked) subjectIds[subject.id]=true;else delete subjectIds[subject.id];return {...previous,subjectIds};})} /><span>{subject.code} — {subject.title}</span></label>) : <p className="muted-copy">Add subjects to the CCT Directory for this school first.</p>}</div></fieldset>
        </>}
        {col === 'sections' && <><Input label="Section Name" value={form.name} onChange={field('name')} disabled={readOnlyIdentity} maxLength={60} /><Select label="Section Year Level" value={String(form.yearLevel)} onChange={field('yearLevel')} options={YEAR_LEVELS.map((label,i)=>({value:String(i+1),label}))} /></>}
        {col === 'retention' && <><Select label="Student" value={form.studentId} onChange={field('studentId')} disabled={readOnlyIdentity} options={formStudents.map((student)=>({value:student.id,label:`${student.studentNumber} · ${student.name}`}))} />
          <Select label="Section and Academic Year" value={form.sectionId} onChange={field('sectionId')} options={formSections.map((section)=>({value:section.id,label:`${section.name} · ${section.academicYear} · ${YEAR_LEVELS[section.yearLevel-1]}`}))} />
          {!formSections.length && <p className="muted-copy">Create a section for this school and Academic Year before adding retention.</p>}
          <Select label="Retention / Movement" value={form.movement} onChange={field('movement')} options={MOVEMENTS} />
          {['Shiftee','Transferee'].includes(form.movement) && <Input label={form.movement==='Shiftee' ? 'Destination Program' : 'Destination School'} value={form.destination} onChange={field('destination')} maxLength={160} />}
        </>}
        {col === 'faculty' && <><Input label="Faculty Number" value={form.staffNumber} onChange={field('staffNumber')} disabled={readOnlyIdentity} maxLength={40} /><Input label="Faculty Name" value={form.name} onChange={field('name')} maxLength={100} /><Input label="Performance Rating (1.00–5.00)" type="number" min={1} max={5} step="0.01" value={form.rating} onChange={field('rating')} /></>}
        {col === 'departmentHeads' && <Select label="Assigned Department Head" value={form.facultyId} onChange={field('facultyId')} options={data.faculty.filter((faculty)=>faculty.department===form.department).map((faculty)=>({value:faculty.id,label:`${faculty.name} · ${faculty.staffNumber} · ${faculty.academicYear}`}))} />}
        {col === 'achievements' && <><Input label="School Achievement Title" value={form.title} onChange={field('title')} maxLength={180} /><Input label="Achievement Date" type="date" optional value={form.achievedOn} onChange={field('achievedOn')} /><Notes label="Description" value={form.description} onChange={field('description')} /></>}
        {!['sections','departmentHeads','achievements'].includes(col) && <Notes value={form.notes} onChange={field('notes')} />}
        <div className="flex flex-wrap justify-end gap-3 pt-3"><button type="button" className="control-lift" disabled={busy} onClick={()=>setEditor(null)}>Cancel</button><button type="submit" className="primary-action" disabled={busy} aria-busy={busy}>{busy ? 'Saving…' : 'Save CCT Entry'}</button></div>
      </form>
    </Modal>
    <ConfirmDialog open={Boolean(deleting)} title="Remove CCT Entry" message="Remove this entry? Other devices will receive this change. Entries referenced by retention or a Department Head assignment cannot be deleted." busy={busy} onCancel={()=>!busy&&setDeleting(null)} onConfirm={remove} confirmLabel="Remove" />
    {notice && <Toast {...notice} onClose={()=>setNotice(null)} />}
    <p className="sync-note"><ShieldCheck className="h-4 w-4" />CCT data access follows your verified school and role.</p>
  </div>;
}
