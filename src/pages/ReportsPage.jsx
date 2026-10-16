import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/auth';
import { CustomSelect } from '../components/common/CustomSelect';
import {
  Award,
  BarChart3,
  Building2,
  CheckCircle2,
  Download,
  FileCheck,
  Filter,
  GraduationCap,
  Printer,
  ShieldCheck,
  TrendingUp
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { RECORD_STATUS, SEMESTER_OPTIONS } from '../utils/academic';
import { csvCell } from '../utils/csv';

const shortDepartmentName = (department) => {
  const name = typeof department === 'string'
    ? department
    : (department?.name || department?.id || String(department || ''));
  return name.replace(/^School of\s+/i, '').replace(/^Office of\s+/i, '');
};

export const ReportsPage = ({ isDarkMode }) => {
  const { currentUser, records, departments, permissions } = useAuth();

  const approvedRecords = useMemo(() => records.filter((record) => record.status === RECORD_STATUS.APPROVED), [records]);
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

  const filtered = approvedRecords.filter((record) => (
    (permissions.canViewAllDepartments || record.department === currentUser?.department)
    && (selectedAY === 'ALL' || record.academicYear === selectedAY)
    && (selectedSem === 'ALL' || record.semester === selectedSem)
    && (selectedDept === 'ALL' || record.department === selectedDept)
  ));

  const totalEnrolled = filtered.reduce((total, record) => total + (Number(record.enrolledCount) || 0), 0);
  const totalPassed = filtered.reduce((total, record) => total + (Number(record.passedCount) || 0), 0);
  const totalFailed = filtered.reduce((total, record) => total + (Number(record.failedCount) || 0), 0);
  const totalDropped = filtered.reduce((total, record) => total + (Number(record.droppedCount) || 0), 0);
  const overallRate = totalEnrolled > 0 ? ((totalPassed / totalEnrolled) * 100).toFixed(2) : '0.00';

  const departmentReportData = departments.map((department) => {
    const departmentRecords = filtered.filter((record) => record.department === department);
    const enrolled = departmentRecords.reduce((total, record) => total + (Number(record.enrolledCount) || 0), 0);
    const passed = departmentRecords.reduce((total, record) => total + (Number(record.passedCount) || 0), 0);
    const failed = departmentRecords.reduce((total, record) => total + (Number(record.failedCount) || 0), 0);
    return {
      name: shortDepartmentName(department),
      fullName: department,
      enrolled,
      passed,
      failed,
      passingRate: enrolled > 0 ? Number(((passed / enrolled) * 100).toFixed(2)) : 0
    };
  }).filter((item) => item.enrolled > 0);

  const topUnit = [...departmentReportData].sort((a, b) => b.passingRate - a.passingRate)[0];

  const handleExportCSV = () => {
    const headers = [
      'ID', 'Department', 'Program', 'Academic Year', 'Semester', 'Subject Code', 'Subject Title',
      'Enrolled', 'Passed', 'Failed', 'Dropped', 'Incomplete', 'Passing Rate (%)',
      'Average Grade', 'Encoded By', 'Approved By', 'Approved At', 'Review Note', 'Updated At'
    ];
    const rows = filtered.map((record) => [
      record.id,
      record.department,
      record.programName || 'Department-wide',
      record.academicYear,
      record.semester,
      record.subjectCode,
      record.subjectTitle,
      record.enrolledCount,
      record.passedCount,
      record.failedCount,
      record.droppedCount || 0,
      record.incCount || 0,
      record.passingRate,
      record.averageGrade,
      record.encodedBy,
      record.approvedBy,
      record.approvedAt,
      record.reviewNote,
      record.updatedAt
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
    <div className="page-stack space-y-4 sm:space-y-5">
      <section className="hero-panel hero-motion relative overflow-hidden rounded-2xl border border-gold-500/30 bg-gradient-to-br from-slate-950 via-crimson-950 to-gold-950 p-5 text-white sm:p-6 lg:p-7 shadow-xl shadow-gold-950/40 print:hidden">
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-gold-500/25 blur-3xl" />
        <div className="absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-crimson-600/20 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-normal text-gold-400">
              <BarChart3 className="h-4 w-4" />
              Official Analytics & Reports
            </div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">CCT Academic Performance</h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gold-100/90 sm:text-sm">
              Reports exclude pending and returned records. Every included row has completed dean or VPAA approval.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-gold-400/30 bg-crimson-900/40 px-3 py-1.5 text-xs font-bold text-gold-200">
                <ShieldCheck className="h-3.5 w-3.5 text-gold-400" /> {currentUser?.role}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-gold-400/30 bg-crimson-900/40 px-3 py-1.5 text-xs font-bold text-gold-200">
                <FileCheck className="h-3.5 w-3.5 text-emerald-400" /> Approved rows: {filtered.length}
              </span>
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={filtered.length === 0}
              className="glass-control control-lift min-h-11 rounded-xl border border-gold-400/30 bg-crimson-950/40 px-4 text-sm font-bold text-gold-200 transition hover:bg-crimson-900/60 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
            >
              <Download className="h-4 w-4" /> Export CSV
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="hero-action button-shine inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-gold-300 to-gold-500 hover:from-gold-200 hover:to-gold-400 px-4 text-sm font-semibold text-slate-950 transition shadow-lg shadow-gold-500/25 cursor-pointer"
            >
              <Printer className="h-4 w-4" /> Print Report
            </button>
          </div>
        </div>
      </section>

      <section className="surface-panel surface-panel-hover relative z-30 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 sm:p-4 print:hidden">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-normal text-slate-500 dark:text-slate-400">
          <Filter className="h-4 w-4 text-crimson-500" /> Report Scope
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          <CustomSelect
            value={selectedAY}
            onChange={setSelectedAY}
            options={[
              { value: 'ALL', label: 'All approved academic years' },
              ...academicYears.map((year) => ({ value: year, label: year }))
            ]}
          />
          <CustomSelect
            value={selectedSem}
            onChange={setSelectedSem}
            options={[
              { value: 'ALL', label: 'All semesters' },
              ...SEMESTER_OPTIONS.map((semester) => ({ value: semester, label: semester }))
            ]}
          />
          {permissions.canViewAllDepartments ? (
            <CustomSelect
              className="sm:col-span-2 lg:col-span-1"
              value={selectedDept}
              onChange={setSelectedDept}
              options={[
                { value: 'ALL', label: 'All academic units' },
                ...departments.map((department) => ({ value: department, label: department }))
              ]}
            />
          ) : (
            <div className="form-control flex items-center gap-2 bg-slate-50 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300 sm:col-span-2 lg:col-span-1">
              <Building2 className="h-4 w-4 shrink-0 text-crimson-500" /><span className="truncate">{currentUser?.department || ''}</span>
            </div>
          )}
        </div>
      </section>

      <div className="hidden border-b-2 border-slate-900 pb-4 text-center print:block">
        <h1 className="text-xl font-semibold tracking-normal text-slate-900">City College of Tagaytay</h1>
        <h2 className="mt-1 text-sm font-bold text-slate-700">Office of the Vice President for Academic Affairs</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Approved Academic Performance Report — {selectedAY === 'ALL' ? 'All Academic Years' : selectedAY}</p>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Overall passing rate', value: `${overallRate}%`, icon: TrendingUp, className: 'text-crimson-700 dark:text-crimson-300' },
          { label: 'Approved enrollment', value: totalEnrolled.toLocaleString(), icon: GraduationCap, className: 'text-crimson-700 dark:text-crimson-300' },
          { label: 'Passed students', value: totalPassed.toLocaleString(), icon: CheckCircle2, className: 'text-emerald-700 dark:text-emerald-300' },
          { label: 'Approved records', value: filtered.length, icon: FileCheck, className: 'text-violet-700 dark:text-violet-300' }
        ].map(({ label, value, icon: Icon, className }) => (
          <div key={label} className="metric-tile rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold tracking-normal text-slate-500 dark:text-slate-400">{label}</div>
              <Icon className={`h-4 w-4 ${className}`} />
            </div>
            <div className={`mt-2 font-mono text-xl font-semibold sm:text-2xl ${className}`}>{value}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <div className="surface-panel surface-panel-hover chart-panel interactive-surface relative rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5 print:border-slate-300 print:shadow-none">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-slate-950 dark:text-white">CCT Aggregate Academic Outcomes</h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Aggregate enrollment and outcomes from approved subject records. Counts represent course enrollments.</p>
          </div>
          <div className="h-72 w-full sm:h-80">
            {departmentReportData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[{name:'CCT Outcomes',fullName:'City College of Tagaytay',enrolled:totalEnrolled,passed:totalPassed,failed:totalFailed}]} margin={{ top: 8, right: 8, left: -22, bottom: 35 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#334155' : '#e2e8f0'} />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: isDarkMode ? '#94a3b8' : '#64748b' }} interval={0} angle={-12} textAnchor="end" />
                  <YAxis tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} />
                  <Tooltip
                    cursor={{ fill: isDarkMode ? 'rgba(212, 175, 55, 0.08)' : 'rgba(139, 30, 63, 0.05)' }}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ''}
                    contentStyle={{
                      backgroundColor: isDarkMode ? '#0f172a' : '#fff',
                      borderColor: isDarkMode ? '#334155' : '#e2e8f0',
                      borderRadius: 14,
                      boxShadow: isDarkMode ? '0 18px 38px -18px rgba(0, 0, 0, 0.9)' : '0 18px 38px -20px rgba(15, 23, 42, 0.32)',
                      fontSize: 11
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="enrolled" name="Enrolled" fill="var(--neu-chart-1)" radius={[5, 5, 0, 0]} animationDuration={700} />
                  <Bar dataKey="passed" name="Passed" fill="var(--neu-chart-3)" radius={[5, 5, 0, 0]} animationDuration={820} />
                  <Bar dataKey="failed" name="Failed" fill="var(--neu-chart-5)" radius={[5, 5, 0, 0]} animationDuration={940} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-full place-items-center rounded-xl border border-dashed border-slate-300 text-sm text-slate-500 dark:text-slate-400 dark:border-slate-700">No approved data matches the selected report scope.</div>
            )}
          </div>
        </div>

        <div className="flex flex-col justify-between h-full space-y-3">
          <div className="notice-card rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900 dark:text-emerald-100"><Award className="h-4 w-4" />Highest passing rate</div>
            <div className="mt-3 text-2xl font-semibold text-emerald-700 dark:text-emerald-300">{topUnit ? `${topUnit.passingRate}%` : '—'}</div>
            <div className="mt-1 text-xs font-semibold text-emerald-800 dark:text-emerald-200">{topUnit?.fullName || 'No approved unit data'}</div>
          </div>

          <div className="surface-panel surface-panel-hover rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 flex-1 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-950 dark:text-white tracking-normal">Outcome Totals</h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">CCT aggregate statistics</p>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800/80">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Passed Students</span>
                  <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">{totalPassed.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800/80">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Failed Students</span>
                  <span className="font-mono font-semibold text-rose-600 dark:text-rose-400">{totalFailed.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800/80">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Dropped Students</span>
                  <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">{totalDropped.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800/80">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Total Enrolled</span>
                  <span className="font-mono font-semibold text-crimson-600 dark:text-crimson-400">{totalEnrolled.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 text-sm">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Approval integrity</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">100% approved</span>
            </div>
          </div>
        </div>
      </section>

      <section className="surface-panel overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 print:border-slate-300 print:shadow-none">
        <div className="border-b border-slate-100 p-4 dark:border-slate-800 sm:p-5">
          <h2 className="text-sm font-semibold text-slate-950 dark:text-white">Approved Record Detail</h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{filtered.length} record{filtered.length === 1 ? '' : 's'} included in this report.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="bg-slate-50 font-semibold tracking-normal text-slate-500 dark:bg-slate-800/70 dark:text-slate-400 text-xs">
              <tr>
                <th className="px-4 py-3.5">Subject</th><th className="px-4 py-3.5">Academic Unit</th><th className="px-4 py-3.5">Term</th><th className="px-4 py-3.5 text-right">Enrolled</th><th className="px-4 py-3.5 text-right">Passed</th><th className="px-4 py-3.5 text-right">Rate</th><th className="px-4 py-3.5">Approved by</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((record) => (
                <tr key={record.id} className="table-row-lift transition hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3.5"><div className="font-mono font-semibold text-crimson-700 dark:text-crimson-300">{record.subjectCode}</div><div className="mt-0.5 text-slate-600 dark:text-slate-300 font-semibold">{record.subjectTitle}</div></td>
                  <td className="max-w-[15rem] px-4 py-3.5 text-slate-600 dark:text-slate-300"><div>{record.department}</div><div className="mt-1 text-xs font-bold text-gold-700 dark:text-gold-300">{record.programName || 'Department-wide'}</div></td>
                  <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400">{record.academicYear}<br /><span className="text-xs">{record.semester}</span></td>
                  <td className="px-4 py-3.5 text-right font-mono font-bold">{record.enrolledCount}</td>
                  <td className="px-4 py-3.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">{record.passedCount}</td>
                  <td className="px-4 py-3.5 text-right font-mono font-semibold text-crimson-600 dark:text-crimson-400">{record.passingRate}%</td>
                  <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400"><div className="font-semibold text-slate-700 dark:text-slate-300">{record.approvedBy || 'Authorized approver'}</div><div className="text-xs">{record.approvedAt || record.updatedAt}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div className="p-12 text-center text-sm text-slate-500 dark:text-slate-400">No approved records match this report scope.</div>}
      </section>
    </div>
  );
};
