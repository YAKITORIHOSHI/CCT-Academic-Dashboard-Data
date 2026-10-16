import React, { useEffect, useMemo, useState } from 'react';
import {
  Award, Building2, CheckCircle2, Download, FileCheck, Filter,
  GraduationCap, Printer, ShieldCheck, TrendingUp
} from 'lucide-react';
import { useAuth } from '../context/auth';
import { AggregateChart } from '../components/common/AggregateChart';
import { TrendChart } from '../components/common/AcademicCharts';
import { CustomSelect } from '../components/common/CustomSelect';
import { StatCard } from '../components/common/StatCard';
import { RECORD_STATUS, SEMESTER_OPTIONS } from '../utils/academic';
import { csvCell } from '../utils/csv';

export const ReportsPage = () => {
  const { currentUser, records, departments, permissions } = useAuth();
  const approvedRecords = useMemo(() => records.filter((record) => (
    record.status === RECORD_STATUS.APPROVED
    && (permissions.canViewAllDepartments || record.department === currentUser?.department)
  )), [records, permissions.canViewAllDepartments, currentUser?.department]);
  const academicYears = useMemo(() => Array.from(new Set(approvedRecords.map((record) => record.academicYear).filter(Boolean))).sort().reverse(), [approvedRecords]);
  const [selectedAY, setSelectedAY] = useState(academicYears[0] || 'ALL');
  const [selectedSem, setSelectedSem] = useState('ALL');
  const [selectedDept, setSelectedDept] = useState(permissions.canViewAllDepartments ? 'ALL' : (currentUser?.department || ''));

  useEffect(() => {
    if (selectedAY !== 'ALL' && !academicYears.includes(selectedAY)) setSelectedAY(academicYears[0] || 'ALL');
  }, [academicYears, selectedAY]);

  useEffect(() => {
    setSelectedDept(permissions.canViewAllDepartments ? 'ALL' : (currentUser?.department || ''));
  }, [currentUser?.id, currentUser?.department, permissions.canViewAllDepartments]);

  const recordsAcrossYears = useMemo(() => approvedRecords.filter((record) => (
    (selectedSem === 'ALL' || record.semester === selectedSem)
    && (selectedDept === 'ALL' || record.department === selectedDept)
  )), [approvedRecords, selectedSem, selectedDept]);
  const filtered = useMemo(() => recordsAcrossYears.filter((record) => (
    selectedAY === 'ALL' || record.academicYear === selectedAY
  )), [recordsAcrossYears, selectedAY]);

  const totalEnrolled = filtered.reduce((total, record) => total + (Number(record.enrolledCount) || 0), 0);
  const outcomes = [
    { label: 'Passed', field: 'passedCount' },
    { label: 'Failed', field: 'failedCount' },
    { label: 'Dropped', field: 'droppedCount' },
    { label: 'Incomplete', field: 'incCount' }
  ].map(({ label, field }) => ({ label, value: filtered.reduce((total, record) => total + (Number(record[field]) || 0), 0) }));
  const totalPassed = outcomes[0].value;
  const overallRate = totalEnrolled > 0 ? `${((totalPassed / totalEnrolled) * 100).toFixed(2)}%` : '—';
  const reportYear = selectedAY === 'ALL' ? 'All academic years' : selectedAY;
  const reportSemester = selectedSem === 'ALL' ? 'All semesters' : selectedSem;
  const reportDepartment = selectedDept === 'ALL' ? 'All academic units' : (selectedDept || 'No academic unit assigned');

  const enrollmentTrend = useMemo(() => {
    const totals = new Map();
    for (const record of recordsAcrossYears) {
      if (!record.academicYear) continue;
      totals.set(record.academicYear, (totals.get(record.academicYear) || 0) + (Number(record.enrolledCount) || 0));
    }
    return [...totals].sort(([a], [b]) => a.localeCompare(b)).map(([label, value]) => ({ label, value }));
  }, [recordsAcrossYears]);

  const topUnit = useMemo(() => {
    const units = new Map();
    for (const record of filtered) {
      const unit = units.get(record.department) || { name: record.department, enrolled: 0, passed: 0 };
      unit.enrolled += Number(record.enrolledCount) || 0;
      unit.passed += Number(record.passedCount) || 0;
      units.set(record.department, unit);
    }
    return [...units.values()].filter((unit) => unit.enrolled > 0)
      .map((unit) => ({ ...unit, passingRate: unit.passed / unit.enrolled * 100 }))
      .sort((a, b) => b.passingRate - a.passingRate)[0];
  }, [filtered]);

  const handleExportCSV = () => {
    const headers = [
      'ID', 'Department', 'Program', 'Academic Year', 'Semester', 'Subject Code', 'Subject Title',
      'Enrolled', 'Passed', 'Failed', 'Dropped', 'Incomplete', 'Passing Rate (%)',
      'Average Grade', 'Encoded By', 'Approved By', 'Approved At', 'Review Note', 'Updated At'
    ];
    const rows = filtered.map((record) => [
      record.id, record.department, record.programName || 'Department-wide', record.academicYear,
      record.semester, record.subjectCode, record.subjectTitle, record.enrolledCount,
      record.passedCount, record.failedCount, record.droppedCount || 0, record.incCount || 0,
      record.passingRate, record.averageGrade, record.encodedBy, record.approvedBy,
      record.approvedAt, record.reviewNote, record.updatedAt
    ].map(csvCell));
    const csv = [headers.map(csvCell).join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `CCT_Approved_Academic_Report_${selectedAY.replace(/\s+/g, '_')}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page-stack space-y-6">
      <section className="workspace-heading flex flex-col justify-between gap-5 xl:flex-row xl:items-end print:hidden">
        <div className="min-w-0">
          <p className="workspace-eyebrow">CCT Academic Affairs · Official Analytics</p>
          <h1 className="workspace-title">CCT Academic Reports</h1>
          <p className="workspace-subtitle">Explore approved performance, compare academic years, and prepare your report.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={filtered.length === 0}
            className="control-lift inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <Download className="h-4 w-4" aria-hidden="true" /> Export CSV
          </button>
          <button type="button" onClick={() => window.print()} className="primary-action inline-flex items-center justify-center gap-2">
            <Printer className="h-4 w-4" aria-hidden="true" /> Print Report
          </button>
        </div>
      </section>

      <section className="surface-panel relative z-30 p-5 sm:p-6 print:hidden" aria-label="Report filters">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="section-heading flex items-center gap-2"><Filter className="h-4 w-4 text-crimson-600 dark:text-crimson-300" aria-hidden="true" /> Report Scope</h2>
            <p className="muted-copy mt-1">Choose the records included in the outcome summary, detail table, and CSV.</p>
          </div>
          <span className="academic-year-chip"><ShieldCheck className="h-4 w-4 text-emerald-700 dark:text-emerald-300" aria-hidden="true" /> Approved records only</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Academic Year</p>
            <CustomSelect ariaLabel="Report Academic Year" value={selectedAY} onChange={setSelectedAY} options={[
              { value: 'ALL', label: 'All approved academic years' },
              ...academicYears.map((year) => ({ value: year, label: year }))
            ]} />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Semester</p>
            <CustomSelect ariaLabel="Report Semester" value={selectedSem} onChange={setSelectedSem} options={[
              { value: 'ALL', label: 'All semesters' },
              ...SEMESTER_OPTIONS.map((semester) => ({ value: semester, label: semester }))
            ]} />
          </div>
          <div className="space-y-2 sm:col-span-2 xl:col-span-1">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Academic Unit</p>
            {permissions.canViewAllDepartments ? (
              <CustomSelect ariaLabel="Report Academic Unit" value={selectedDept} onChange={setSelectedDept} options={[
                { value: 'ALL', label: 'All academic units' },
                ...departments.map((department) => ({ value: department, label: department }))
              ]} />
            ) : (
              <div className="form-control flex min-h-11 items-center gap-2 bg-slate-50 text-sm font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <Building2 className="h-4 w-4 shrink-0 text-crimson-600 dark:text-crimson-300" aria-hidden="true" /><span>{reportDepartment}</span>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="hidden border-b-2 border-slate-900 pb-4 text-center print:block">
        <h1 className="text-xl font-semibold text-slate-900">City College of Tagaytay</h1>
        <h2 className="mt-1 text-sm font-bold text-slate-700">Office of the Vice President for Academic Affairs</h2>
        <p className="mt-1 text-sm text-slate-600">Approved Academic Performance Report · {reportYear}</p>
        <p className="mt-1 text-xs text-slate-600">{reportSemester} · {reportDepartment}</p>
      </div>

      <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4" aria-label="Approved academic performance summary">
        <StatCard title="Overall Passing Rate" value={overallRate} subtitle={totalEnrolled > 0 ? 'Passed ÷ approved course enrollment' : 'No enrolled course totals in this scope'} icon={TrendingUp} color="blue" />
        <StatCard title="Approved Enrollment" value={totalEnrolled.toLocaleString()} subtitle="Course enrollments in the selected scope" icon={GraduationCap} color="emerald" />
        <StatCard title="Passing Outcomes" value={totalPassed.toLocaleString()} subtitle="Passed courses from approved records" icon={CheckCircle2} color="violet" />
        <StatCard title="Approved Records" value={filtered.length.toLocaleString()} subtitle={`${reportYear} · ${reportSemester}`} icon={FileCheck} color="amber" />
      </section>

      <section className="grid min-w-0 gap-6 xl:grid-cols-2" aria-label="Academic report charts">
        <AggregateChart
          title="CCT Academic Outcomes"
          description="Passed, failed, dropped, and incomplete outcomes for the selected report scope. Counts represent course enrollments."
          items={outcomes}
          variant="donut"
          valueLabel="Recorded outcomes"
          hasData={filtered.length > 0}
          empty="No approved records match this report scope."
        />
        <TrendChart
          title="Enrollment by Academic Year"
          description={`All academic years with approved records · ${reportSemester} · ${reportDepartment}. This trend spans years independently of the Academic Year filter above.`}
          data={enrollmentTrend}
          valueLabel="Course enrollments"
          hasData={enrollmentTrend.length > 0}
          empty="No approved academic years match the selected semester and academic unit."
        />
      </section>

      <section className="surface-panel grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]" aria-label="Report context">
        <div>
          <h2 className="section-heading flex items-center gap-2"><Award className="h-4 w-4 text-gold-600 dark:text-gold-300" aria-hidden="true" /> Highest Passing Rate</h2>
          <div className="mt-4 flex items-baseline gap-3">
            <strong className="text-3xl font-semibold tracking-tight text-emerald-700 dark:text-emerald-300 tabular-nums">{topUnit ? `${topUnit.passingRate.toFixed(2)}%` : '—'}</strong>
            <span className="muted-copy">in this report scope</span>
          </div>
          <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-200">{topUnit?.name || 'No academic unit with enrolled course totals'}</p>
          {topUnit && <p className="muted-copy mt-1">{topUnit.passed.toLocaleString()} passing outcomes from {topUnit.enrolled.toLocaleString()} course enrollments</p>}
        </div>
        <div className="border-t border-slate-200 pt-5 dark:border-slate-800 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <h2 className="section-heading">Reading This Report</h2>
          <p className="muted-copy mt-2 leading-relaxed">Totals include approved subject records within your permitted academic units. A student enrolled in several courses can appear in several course counts. The annual student headcount is reported separately in Annual Reports.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="academic-year-chip">{reportYear}</span>
            <span className="academic-year-chip">{reportSemester}</span>
            <span className="academic-year-chip">{reportDepartment}</span>
          </div>
        </div>
      </section>

      <section className="surface-panel overflow-hidden print:border-slate-300 print:shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5 dark:border-slate-800 sm:p-6">
          <div>
            <h2 className="section-heading">Approved Record Detail</h2>
            <p className="muted-copy mt-1">{filtered.length.toLocaleString()} record{filtered.length === 1 ? '' : 's'} included in the summary and CSV export.</p>
          </div>
          <span className="academic-year-chip"><FileCheck className="h-4 w-4" aria-hidden="true" /> {filtered.length ? 'Approval verified' : 'No records in scope'}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <caption className="sr-only">Approved academic records for {reportYear}, {reportSemester}, {reportDepartment}</caption>
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500 dark:bg-slate-800/70 dark:text-slate-400">
              <tr>
                <th scope="col" className="px-5 py-3.5">Subject</th>
                <th scope="col" className="px-5 py-3.5">Academic Unit</th>
                <th scope="col" className="px-5 py-3.5">Term</th>
                <th scope="col" className="px-5 py-3.5 text-right">Enrolled</th>
                <th scope="col" className="px-5 py-3.5 text-right">Passed</th>
                <th scope="col" className="px-5 py-3.5 text-right">Rate</th>
                <th scope="col" className="px-5 py-3.5">Approved by</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((record) => (
                <tr key={record.id} className="table-row-lift transition hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                  <td className="px-5 py-4"><div className="font-semibold text-crimson-700 dark:text-crimson-300">{record.subjectCode}</div><div className="mt-1 text-slate-600 dark:text-slate-300">{record.subjectTitle}</div></td>
                  <td className="max-w-[15rem] px-5 py-4 text-slate-600 dark:text-slate-300"><div>{record.department}</div><div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{record.programName || 'Department-wide'}</div></td>
                  <td className="px-5 py-4 text-slate-600 dark:text-slate-300">{record.academicYear}<br /><span className="mt-1 inline-block text-xs text-slate-500 dark:text-slate-400">{record.semester}</span></td>
                  <td className="px-5 py-4 text-right font-semibold tabular-nums">{record.enrolledCount}</td>
                  <td className="px-5 py-4 text-right font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">{record.passedCount}</td>
                  <td className="px-5 py-4 text-right font-semibold tabular-nums text-crimson-700 dark:text-crimson-300">{record.passingRate}%</td>
                  <td className="px-5 py-4"><div className="font-medium text-slate-700 dark:text-slate-300">{record.approvedBy || 'Authorized approver'}</div><div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{record.approvedAt || record.updatedAt}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div className="empty-work p-10 text-center">No approved records match this report scope.</div>}
      </section>
    </div>
  );
};
