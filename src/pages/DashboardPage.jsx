import React, { useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, CheckCircle2, ClipboardCheck, GraduationCap, TrendingUp, Users } from 'lucide-react';
import { useAuth } from '../context/auth';
import { useAcademicData } from '../context/academicData';
import { AggregateChart } from '../components/common/AggregateChart';
import { TrendChart } from '../components/common/AcademicCharts';
import { StatCard } from '../components/common/StatCard';
import { CustomSelect } from '../components/common/CustomSelect';
import { RECORD_STATUS } from '../utils/academic';

const unitName = (name) => String(name || '').replace(/^School of\s+|^Office of\s+/i, '');

export const DashboardPage = ({ setActiveTab }) => {
  const { currentUser, records, accounts, permissions, dataSync, isFirebaseConnected } = useAuth();
  const { annualReports, topcit } = useAcademicData();
  const [selectedYear, setSelectedYear] = useState('');
  const scopedRecords = useMemo(() => records.filter((record) => permissions.canViewAllDepartments
    || record.department === currentUser?.department), [records, permissions.canViewAllDepartments, currentUser?.department]);
  const years = useMemo(() => [...new Set([...scopedRecords.filter((r) => r.status === RECORD_STATUS.APPROVED), ...annualReports, ...topcit]
    .map((r) => r.academicYear).filter(Boolean))].sort().reverse(), [scopedRecords, annualReports, topcit]);
  const activeYear = years.includes(selectedYear) ? selectedYear : years[0] || '';
  const summary = useMemo(() => {
    const approved = []; const pending = []; const returned = []; const units = new Map();
    let enrolled = 0; let passed = 0;
    for (const record of scopedRecords) {
      if (record.status === RECORD_STATUS.PENDING) pending.push(record);
      if (record.status === RECORD_STATUS.RETURNED) returned.push(record);
      if (record.status !== RECORD_STATUS.APPROVED || record.academicYear !== activeYear) continue;
      approved.push(record);
      const count = Number(record.enrolledCount) || 0;
      const successes = Number(record.passedCount) || 0;
      enrolled += count; passed += successes;
      const unit = units.get(record.department) || { name: record.department, enrolled: 0, passed: 0, records: 0 };
      unit.enrolled += count; unit.passed += successes; unit.records += 1;
      units.set(record.department, unit);
    }
    return { approved, pending, returned, enrolled, passed,
      rate: enrolled ? (passed / enrolled * 100).toFixed(1) : '0.0',
      units: [...units.values()].sort((a,b) => b.enrolled - a.enrolled) };
  }, [scopedRecords, activeYear]);
  const activePeople = accounts.filter((account) => account.status === 'Active' && account.uid
    && (permissions.canViewAllDepartments || account.department === currentUser?.department)).length;
  const outcomes = ['passedCount','failedCount','droppedCount','incCount'].map((field,index) => ({
    label: ['Passed','Failed','Dropped','Incomplete'][index], value: summary.approved.reduce((sum,row) => sum + Number(row[field] || 0), 0)
  }));
  const annual = annualReports.find((report) => report.academicYear === activeYear);
  const annualTotal = annual?.total !== null && annual?.total !== undefined && annual?.total !== '' && Number.isFinite(Number(annual?.total)) && Number(annual.total) >= 0 ? Number(annual.total) : null;
  const annualTrend = useMemo(() => [...annualReports].sort((a, b) => String(a.academicYear).localeCompare(String(b.academicYear)))
    .map((report) => ({ label: report.academicYear, value: report.total })), [annualReports]);
  const topcitAnnual = topcit.find((report) => report.academicYear === activeYear);
  const recent = useMemo(() => [...scopedRecords].sort((a,b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))).slice(0,4), [scopedRecords]);
  const actionLabel = permissions.isPresident ? 'View Reports' : permissions.isHead ? 'Encode a Record' : 'Review Records';
  const nextActions = permissions.isPresident
    ? [{ count: summary.approved.length, title: 'Approved Reports', text: 'Open the official academic report.', tab: 'reports' }]
    : [
      { count: summary.pending.length, title: permissions.isHead ? 'Submitted for Review' : 'Awaiting Your Review', text: permissions.isHead ? 'Track records submitted to your dean.' : 'Review submissions before they enter reports.', tab: 'records' },
      { count: summary.returned.length, title: 'Returned for Revision', text: 'Open the reviewer’s notes and corrections.', tab: 'records' }
    ];

  return (
    <div className="page-stack space-y-6">
      <section className="workspace-heading flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
        <div>
          <p className="workspace-eyebrow">CCT Academic Affairs · {permissions.canViewAllDepartments ? 'College-Wide View' : unitName(currentUser?.department)}</p>
          <h1 className="workspace-title">CCT Academic Overview</h1>
          <p className="workspace-subtitle">A clear view of performance, submissions, and the work that needs your attention.</p>
        </div>
        <div className="overview-actions">
          <button type="button" onClick={() => setActiveTab(permissions.isPresident ? 'reports' : 'records')} className="primary-action inline-flex items-center gap-2">
            {actionLabel}<ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </section>

      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-3">
          <span className="academic-year-chip"><CalendarDays className="h-4 w-4" aria-hidden="true" />Academic Year</span>
          <div className="w-full sm:w-48">
            <CustomSelect value={activeYear} onChange={setSelectedYear} options={years} placeholder="No approved records" ariaLabel="Academic Year" disabled={!years.length} />
          </div>
        </div>
        <p className="sync-note" role="status"><span className="sync-dot" style={{ background: dataSync?.status === 'error' ? '#b43c4e' : isFirebaseConnected ? '#25734f' : '#99702c' }} />
          {dataSync?.pendingWrites ? 'Saving changes…' : dataSync?.status === 'error' ? 'Updates need attention' : !isFirebaseConnected ? 'Offline · Last available data' : dataSync?.status === 'syncing' ? 'Updating records…' : 'Live updates enabled'}
        </p>
      </div>

      <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4" aria-label="Academic performance summary">
        <StatCard title="Passing Rate" value={`${summary.rate}%`} subtitle={`${summary.passed.toLocaleString()} passing outcomes`} icon={TrendingUp} color="blue" />
        <StatCard title="Approved Enrollment" value={summary.enrolled.toLocaleString()} subtitle={`${summary.approved.length} approved subject records`} icon={GraduationCap} color="emerald" />
        <StatCard title="Pending Review" value={summary.pending.length} subtitle={summary.pending.length ? 'Submissions awaiting a decision' : 'No outstanding submissions'} icon={ClipboardCheck} color="amber" />
        <StatCard title={permissions.isVPAA ? 'Active CCT Personnel' : 'My CCT Account'} value={permissions.isVPAA ? activePeople : currentUser?.status || 'Active'} subtitle={permissions.isVPAA ? 'Across City College of Tagaytay' : 'Your verified CCT access'} icon={Users} color="violet" />
      </section>

      <section className="grid min-w-0 gap-6 xl:grid-cols-2">
        <AggregateChart title="CCT Academic Outcomes" description="Aggregate subject outcomes from approved records. These are course enrollments, not unique student headcounts." valueLabel="Course outcomes" items={outcomes} hasData={summary.approved.length > 0} />
        <AggregateChart variant="bar" title="CCT TOPCIT Achieved Levels" description={topcitAnnual ? topcitAnnual.total + ' participants · ' + activeYear : 'Annual participant totals and certificate levels appear after the CCT summary is submitted.'} valueLabel="Participants" hasData={Boolean(topcitAnnual)} items={[1,2,3,4,5].map((level) => ({label:'Level '+level,value:Number(topcitAnnual?.['level'+level] || 0)}))} />
      </section>
      <section className="space-y-3">
        <TrendChart title="CCT Annual Student Enrollment" description={`${annualTotal !== null ? annualTotal.toLocaleString() + ' students · ' + activeYear + '. ' : 'No numeric annual total is available for the selected Academic Year. '}The line shows all reported Academic Years; each point is a separate annual headcount.`} data={annualTrend} valueLabel="Students" hasData={annualReports.length > 0} empty="Annual enrollment will appear after a college-wide report is submitted." />
        <div className="flex justify-end"><button type="button" className="control-lift inline-flex items-center gap-2" onClick={() => setActiveTab('annualReports')}>View Annual Reports<ArrowRight className="h-4 w-4" aria-hidden="true" /></button></div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <article className="surface-panel p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3"><h2 className="section-heading">Recent Academic Records</h2><button type="button" onClick={() => setActiveTab('records')} className="inline-flex items-center gap-1 text-sm font-semibold text-crimson-700 dark:text-crimson-300">View All<ArrowRight className="h-4 w-4" aria-hidden="true" /></button></div>
          <div className="mt-4 space-y-1">{recent.length ? recent.map((record) => <button key={record.id} type="button" onClick={() => setActiveTab('records')} className="unit-row flex w-full items-center justify-between gap-3 text-left">
            <div className="min-w-0"><p className="text-sm font-semibold">{record.subjectCode} <span className="font-normal">· {record.subjectTitle}</span></p><p className="muted-copy mt-1">{unitName(record.department)} · {record.academicYear}</p></div>
            <span className="academic-year-chip shrink-0">{record.status}</span>
          </button>) : <div className="empty-work">Your academic record history will appear here.</div>}</div>
        </article>
        <article className="surface-panel p-5 sm:p-6">
          <h2 className="section-heading">Your Next Steps</h2><p className="muted-copy mt-1">CCT workspace · {currentUser?.role}</p>
          {nextActions.map((action) => <button type="button" key={action.title} className="task-row" onClick={() => setActiveTab(action.tab)}>
            <span className="task-count">{action.count}</span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{action.title}</span><span className="muted-copy mt-1 block">{action.text}</span></span><ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
          </button>)}
          {summary.pending.length === 0 && summary.returned.length === 0 && <p className="muted-copy mt-5 flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />Your reporting queue is clear.</p>}
        </article>
      </section>
    </div>
  );
};
