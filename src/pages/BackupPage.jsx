import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Toast } from '../components/common/Feedback';
import { Modal } from '../components/common/Modal';
import { 
  HardDriveDownload, 
  RotateCcw, 
  ShieldCheck, 
  Database,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  Eye,
  FileText,
  Search,
  Upload,
  RefreshCw,
  Layers
} from 'lucide-react';

export const BackupPage = () => {
  const { currentUser, backups, records, createBackup, restoreBackup, updateRecord, permissions, isFirebaseConnected } = useAuth();

  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState(null);
  const [uploadJsonContent, setUploadJsonContent] = useState('');
  const [restoreStatus, setRestoreStatus] = useState(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [notice, setNotice] = useState(null);

  // Selective Record Recovery states
  const [selectedRecordId, setSelectedRecordId] = useState(null);
  const [recordSearchQuery, setRecordSearchQuery] = useState('');
  const [recordRestoreNotice, setRecordRestoreNotice] = useState('');

  if (!permissions.canManageBackups) return null;

  // Trigger manual backup
  const handleCreateManualBackup = async () => {
    if (isCreatingBackup) return;
    setIsCreatingBackup(true);
    const result = await createBackup('Manual Export');
    setIsCreatingBackup(false);
    if (!result?.success) {
      setNotice({ type: 'error', message: result?.message || 'The backup could not be created.' });
      return;
    }
    const syncMessage = result.synchronized
      ? 'The snapshot was downloaded and synchronized with Firebase.'
      : 'The snapshot was downloaded locally. Firebase synchronization was skipped because the connection is offline.';
    setNotice({ type: 'success', message: `Backup successfully generated: ${result.backup.fileName}\n${syncMessage}` });
  };

  // File upload handler
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setUploadJsonContent('');
      setRestoreStatus({ type: 'error', message: 'The selected JSON file exceeds the 10 MB restore limit.' });
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setUploadJsonContent(event.target.result);
      setRestoreStatus({ type: 'info', message: `Loaded local file: ${file.name}` });
    };
    reader.onerror = () => {
      setUploadJsonContent('');
      setRestoreStatus({ type: 'error', message: 'The selected file could not be read.' });
    };
    reader.readAsText(file);
  };

  // Perform full database restore
  const handleExecuteRestore = async () => {
    if (!uploadJsonContent && !selectedBackup?.rawContent) {
      setRestoreStatus({
        type: 'error',
        message: selectedBackup
          ? 'This history entry contains metadata only. Upload the original JSON snapshot file to restore it.'
          : 'Select a restorable snapshot or upload a JSON snapshot file first.'
      });
      return;
    }
    if (isRestoring) return;

    setIsRestoring(true);
    setRestoreStatus({ type: 'info', message: 'Validating and synchronizing the selected snapshot…' });
    const contentToRestore = selectedBackup?.rawContent || uploadJsonContent;
    const result = await restoreBackup(contentToRestore, selectedBackup?.checksum || '');
    setIsRestoring(false);

    if (result.success) {
      setRestoreStatus({ type: 'success', message: result.message });
      setTimeout(() => {
        setRestoreModalOpen(false);
        setSelectedBackup(null);
        setUploadJsonContent('');
        setRestoreStatus(null);
      }, 1500);
    } else {
      setRestoreStatus({ type: 'error', message: result.message });
    }
  };

  // Re-approve and resynchronize the current live record (not a historical restore).
  const selectedRecordObj = records.find((rec) => rec.id === selectedRecordId);

  const handleSelectiveRecordRestore = () => {
    if (!selectedRecordObj) return;
    const result = updateRecord(selectedRecordObj.id, {
      status: 'Approved',
      approvedBy: currentUser?.name || 'Vice President for Academic Affairs',
      approvedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
      reviewNote: 'Record manually verified, re-approved, and resynchronized with Firebase RTDB.'
    });
    if (!result?.success) {
      setNotice({ type: 'error', message: result?.message || 'The record could not be resynchronized.' });
      return;
    }
    setRecordRestoreNotice(`Record ${selectedRecordObj.subjectCode} (${selectedRecordObj.department}) was re-approved and synchronized.`);
    setTimeout(() => setRecordRestoreNotice(''), 4000);
  };

  const filteredRecords = records.filter((rec) => {
    const query = recordSearchQuery.toLowerCase();
    return (
      rec.subjectCode?.toLowerCase().includes(query) ||
      rec.subjectTitle?.toLowerCase().includes(query) ||
      rec.department?.toLowerCase().includes(query) ||
      rec.status?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="page-stack space-y-4 sm:space-y-6">
      
      {/* Header */}
      <section className="hero-panel hero-motion relative overflow-hidden rounded-3xl border border-sky-500/30 bg-gradient-to-br from-slate-950 via-blue-950 to-sky-950 p-5 text-white sm:p-6 lg:p-7 shadow-xl shadow-sky-950/40">
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-sky-500/25 blur-3xl" />
        <div className="absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-blue-600/20 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-sky-400">
              <HardDriveDownload className="h-4 w-4" />
              Backup, Snapshot & Record Recovery
            </div>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Database Security & System Recovery</h1>
            <p className="mt-2 max-w-3xl text-xs leading-relaxed text-sky-100/90 sm:text-sm">
              VPAA-only tools for Firebase Realtime Database JSON snapshots, validated local imports, and live-record integrity repair.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/30 bg-blue-900/40 px-3 py-1.5 text-[10px] font-bold text-sky-200">
                <ShieldCheck className="h-3.5 w-3.5 text-sky-400" /> {currentUser?.role}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/30 bg-blue-900/40 px-3 py-1.5 text-[10px] font-bold text-sky-200">
                <Database className="h-3.5 w-3.5 text-emerald-400" /> Saved Snapshots: {backups.length}
              </span>
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <button
              type="button"
              onClick={() => {
                setSelectedBackup(null);
                setUploadJsonContent('');
                setRestoreStatus(null);
                setRestoreModalOpen(true);
              }}
              className="glass-control control-lift min-h-11 rounded-xl border border-sky-400/30 bg-blue-950/40 px-4 text-xs font-bold text-sky-200 transition hover:bg-blue-900/60 cursor-pointer flex items-center justify-center gap-2"
            >
              <Upload className="h-4 w-4" /> Import Local JSON
            </button>

            <button
              type="button"
              onClick={handleCreateManualBackup}
              disabled={isCreatingBackup}
              className="hero-action button-shine inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-400 to-blue-500 hover:from-sky-300 hover:to-blue-400 px-4 text-xs font-black text-slate-950 transition shadow-lg shadow-sky-500/25 cursor-pointer disabled:opacity-50"
            >
              <Database className="h-4 w-4" />
              <span>{isCreatingBackup ? 'Creating Snapshot…' : 'Create Snapshot'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Backup Settings & System Security Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        <div className="metric-tile rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 space-y-2 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Backup Mode</span>
            <HardDriveDownload className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white">Manual / On-demand</div>
          <p className="text-xs text-slate-500 dark:text-slate-400">No automated server-side schedule is configured.</p>
        </div>

        <div className="metric-tile rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 space-y-2 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Firebase Snapshots</span>
            <Database className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white">{backups.length} Snapshots Stored</div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Latest: {backups[0]?.createdAt || 'N/A'}</p>
        </div>

        <div className="metric-tile rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 space-y-2 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Firebase Connection</span>
            <ShieldCheck className={`w-4 h-4 ${isFirebaseConnected ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`} />
          </div>
          <div className={`text-lg font-bold ${isFirebaseConnected ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>{isFirebaseConnected ? 'Live' : 'Offline / Reconnecting'}</div>
          <p className="text-xs text-slate-500 dark:text-slate-400">New exports include a SHA-256 integrity checksum.</p>
        </div>

      </div>

      {/* Database Snapshot History Table */}
      <div className="surface-panel overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-sm">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Selectable Database Snapshots</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Snapshots with embedded JSON can be restored; metadata-only entries require the original JSON file</p>
          </div>
        </div>

        <div className="space-y-3 p-4 md:hidden">
          {backups.map((bkp) => (
            <article key={bkp.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                  <FileCode className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="break-all font-mono text-xs font-bold text-slate-900 dark:text-white">{bkp.fileName}</p>
                  <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">{bkp.createdAt} · {bkp.fileSize}</p>
                </div>
                <span className="rounded-full bg-emerald-100 px-2 py-1 text-[9px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">{bkp.status}</span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                <div className="rounded-lg bg-white p-2 dark:bg-slate-900"><dt className="text-slate-400">Type</dt><dd className="mt-0.5 font-semibold text-slate-700 dark:text-slate-300">{bkp.type}</dd></div>
                <div className="rounded-lg bg-white p-2 dark:bg-slate-900"><dt className="text-slate-400">Restore data</dt><dd className="mt-0.5 font-semibold text-slate-700 dark:text-slate-300">{bkp.rawContent ? 'Embedded' : 'Metadata only'}</dd></div>
              </dl>
              <p className="mt-2 truncate font-mono text-[9px] text-slate-400" title={bkp.checksum}>{bkp.checksum}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => { setSelectedBackup(bkp); setPreviewModalOpen(true); }} className="min-h-10 rounded-xl border border-slate-300 bg-white px-3 text-[11px] font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">Preview</button>
                <button type="button" onClick={() => { setSelectedBackup(bkp); setRestoreStatus(null); setRestoreModalOpen(true); }} disabled={!bkp.rawContent} className="min-h-10 rounded-xl bg-indigo-600 px-3 text-[11px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-45">{bkp.rawContent ? 'Restore' : 'Metadata only'}</button>
              </div>
            </article>
          ))}
          {backups.length === 0 && <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-400 dark:border-slate-700">No snapshots have been created yet.</p>}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Backup Snapshot File</th>
                <th className="py-3.5 px-4">Type</th>
                <th className="py-3.5 px-4">Size</th>
                <th className="py-3.5 px-4">Timestamp</th>
                <th className="py-3.5 px-4">SHA-256 Checksum</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {backups.map((bkp) => (
                <tr key={bkp.id} className="table-row-lift hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                  
                  {/* File */}
                  <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white font-mono">
                    <div className="flex items-center space-x-2">
                      <FileCode className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <span>{bkp.fileName}</span>
                    </div>
                  </td>

                  {/* Type */}
                  <td className="py-3.5 px-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      bkp.type.includes('Manual') ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300' : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                    }`}>
                      {bkp.type}
                    </span>
                  </td>

                  {/* Size */}
                  <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-400">{bkp.fileSize}</td>

                  {/* Created */}
                  <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 font-mono">{bkp.createdAt}</td>

                  {/* Checksum */}
                  <td className="py-3.5 px-4 font-mono text-[10px] text-slate-400 dark:text-slate-500 truncate max-w-xs">{bkp.checksum}</td>

                  {/* Status */}
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center space-x-1 text-emerald-700 dark:text-emerald-400 font-semibold text-[10px] bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{bkp.status}</span>
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="py-3.5 px-4 text-right space-x-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedBackup(bkp);
                        setPreviewModalOpen(true);
                      }}
                      className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-semibold text-[11px] border border-slate-300 dark:border-slate-700 transition"
                      title="Inspect JSON payload"
                    >
                      <Eye className="w-3.5 h-3.5 inline mr-1" />
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedBackup(bkp);
                        setRestoreStatus(null);
                        setRestoreModalOpen(true);
                      }}
                      disabled={!bkp.rawContent}
                      title={bkp.rawContent ? 'Restore embedded JSON snapshot' : 'Metadata only; upload the original JSON file'}
                      className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-[11px] transition shadow-sm disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {bkp.rawContent ? 'Restore Snapshot' : 'Metadata Only'}
                    </button>
                  </td>

                </tr>
              ))}
              {backups.length === 0 && (
                <tr><td colSpan="7" className="p-10 text-center text-xs text-slate-400">No snapshots have been created yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selective Record Inspection & Selective Restoration Section */}
      <div className="surface-panel overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <div className="flex items-center space-x-2 text-rose-800 dark:text-amber-400 text-xs font-bold uppercase tracking-wider">
              <Layers className="w-4 h-4" />
              <span>Individual Record Integrity Repair</span>
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">Inspect, Re-approve & Resynchronize Academic Records</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Inspect the current live record and explicitly re-approve it when synchronization repair is required</p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search record code or unit..."
              value={recordSearchQuery}
              onChange={(e) => setRecordSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {recordRestoreNotice && (
          <div className="p-3 bg-emerald-950/80 border border-emerald-800/80 rounded-xl text-emerald-300 text-xs flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{recordRestoreNotice}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          
          {/* Record Selector List */}
          <div className="lg:col-span-1 max-h-80 overflow-y-auto space-y-1.5 pr-1">
            {filteredRecords.map((rec) => (
              <button
                key={rec.id}
                type="button"
                onClick={() => setSelectedRecordId(rec.id)}
                className={`w-full p-3 rounded-xl text-left border transition text-xs flex items-center justify-between ${
                  selectedRecordId === rec.id
                    ? 'border-amber-500/80 bg-rose-950/20 text-white font-bold'
                    : 'border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 hover:border-amber-500/40'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="font-mono font-bold text-amber-500 truncate">{rec.subjectCode} - {rec.subjectTitle}</div>
                  <div className="text-[10px] text-slate-400 truncate mt-0.5">{rec.department}</div>
                </div>
                <span className={`shrink-0 text-[9px] px-2 py-0.5 rounded-full font-bold ml-2 ${
                  rec.status === 'Approved' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-amber-950 text-amber-300 border border-amber-800'
                }`}>
                  {rec.status}
                </span>
              </button>
            ))}
          </div>

          {/* Record Details Payload Inspector & Selective Restore */}
          <div className="lg:col-span-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 space-y-4">
            {selectedRecordObj ? (
              <div className="space-y-4 text-xs">
                <div className="flex flex-col gap-3 border-b border-slate-200 pb-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">{selectedRecordObj.subjectCode}: {selectedRecordObj.subjectTitle}</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{selectedRecordObj.department} ({selectedRecordObj.academicYear})</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSelectiveRecordRestore}
                    className="flex min-h-10 w-full items-center justify-center space-x-1.5 rounded-xl bg-gradient-to-r from-rose-900 to-amber-700 px-3.5 py-2 font-bold text-amber-100 shadow-sm transition hover:from-rose-800 hover:to-amber-600 sm:w-auto"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-amber-300" />
                    <span>Re-approve & Resync</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="block text-[10px] text-slate-400 uppercase font-bold">Enrolled</span>
                    <span className="text-base font-black text-slate-900 dark:text-white">{selectedRecordObj.enrolledCount}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="block text-[10px] text-emerald-500 uppercase font-bold">Passed</span>
                    <span className="text-base font-black text-emerald-600 dark:text-emerald-400">{selectedRecordObj.passedCount}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="block text-[10px] text-rose-500 uppercase font-bold">Failed</span>
                    <span className="text-base font-black text-rose-600 dark:text-rose-400">{selectedRecordObj.failedCount}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="block text-[10px] text-amber-500 uppercase font-bold">Passing Rate</span>
                    <span className="text-base font-black text-amber-500">{selectedRecordObj.passingRate}%</span>
                  </div>
                </div>

                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1 font-mono text-[11px]">
                  <div className="text-slate-400">// Current Firebase Payload Metadata</div>
                  <div className="text-slate-300">ID: <span className="text-amber-400">{selectedRecordObj.id}</span></div>
                  <div className="text-slate-300">Encoded By: {selectedRecordObj.encodedBy}</div>
                  <div className="text-slate-300">Status: {selectedRecordObj.status}</div>
                  <div className="text-slate-300">Approved By: {selectedRecordObj.approvedBy || 'N/A'}</div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400 text-xs space-y-2">
                <FileText className="w-8 h-8 mx-auto text-slate-500 opacity-60" />
                <p>Select a live academic record to inspect its payload. Re-approval updates the current record; it does not recover a historical version.</p>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* JSON Payload Preview Modal */}
      <Modal
        open={previewModalOpen && Boolean(selectedBackup)}
        onClose={() => setPreviewModalOpen(false)}
        ariaLabel="Backup snapshot payload preview"
        className="w-full max-w-2xl space-y-4 rounded-3xl border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 sm:p-6"
      >
        {selectedBackup && (
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Snapshot Payload Preview: {selectedBackup.fileName}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Created at {selectedBackup.createdAt} by {selectedBackup.createdBy}</p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewModalOpen(false)}
                className="control-lift icon-control grid h-9 w-9 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto p-3 bg-slate-950 text-slate-200 rounded-xl font-mono text-[11px]">
              <pre>{selectedBackup.rawContent || JSON.stringify(selectedBackup, null, 2)}</pre>
            </div>

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setPreviewModalOpen(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl font-semibold text-xs"
              >
                Close Preview
              </button>
              <button
                type="button"
                onClick={() => {
                  setPreviewModalOpen(false);
                  setRestoreModalOpen(true);
                }}
                disabled={!selectedBackup.rawContent}
                title={selectedBackup.rawContent ? 'Restore this embedded snapshot' : 'Upload the original JSON file to restore'}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold text-xs disabled:cursor-not-allowed disabled:opacity-45"
              >
                {selectedBackup.rawContent ? 'Proceed to Restore' : 'Metadata Only'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Restore Modal */}
      <Modal
        open={restoreModalOpen}
        onClose={() => !isRestoring && setRestoreModalOpen(false)}
        ariaLabel="System database restore"
        closeOnBackdrop={!isRestoring}
        zIndex={110}
        className="w-full max-w-lg space-y-4 rounded-3xl border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 sm:p-6"
      >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                System Database Restore
              </h3>
              <button
                type="button"
                onClick={() => setRestoreModalOpen(false)}
                disabled={isRestoring}
                className="control-lift icon-control grid h-9 w-9 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              
              {selectedBackup ? (
                <div className="bg-indigo-50 dark:bg-indigo-950/80 p-3 rounded-xl border border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200 space-y-1">
                  <div className="font-bold">Selected Snapshot: {selectedBackup.fileName}</div>
                  <div className="text-[11px]">Created at {selectedBackup.createdAt} by {selectedBackup.createdBy}</div>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300">Upload JSON Database Backup File</label>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileUpload}
                    className="w-full text-xs text-slate-500 dark:text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 dark:file:bg-indigo-950 file:text-indigo-700 dark:file:text-indigo-300 hover:file:bg-indigo-100 dark:hover:file:bg-indigo-900"
                  />
                </div>
              )}

              {restoreStatus && (
                <div className={`p-3 rounded-lg text-xs font-semibold ${
                  restoreStatus.type === 'success' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                  restoreStatus.type === 'error' ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                }`}>
                  {restoreStatus.message}
                </div>
              )}

              <div className="notice-card bg-amber-50 dark:bg-amber-950/60 p-3 rounded-xl border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 space-y-1">
                <div className="font-bold flex items-center space-x-1">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>Warning: System Overwrite</span>
                </div>
                <p className="text-[11px]">
                  A restore replaces only the supported collections present in the selected file: accounts, records/requests, departments, programs, subjects, and audit logs. Missing collections are left unchanged.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setRestoreModalOpen(false)}
                  disabled={isRestoring}
                  className="control-lift px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteRestore}
                  disabled={isRestoring}
                  className="primary-action button-shine px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold flex items-center space-x-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{isRestoring ? 'Restoring…' : 'Execute Data Restore'}</span>
                </button>
              </div>

            </div>
      </Modal>

      <Toast
        message={notice?.message}
        type={notice?.type}
        onClose={() => setNotice(null)}
        duration={6000}
      />

    </div>
  );
};
