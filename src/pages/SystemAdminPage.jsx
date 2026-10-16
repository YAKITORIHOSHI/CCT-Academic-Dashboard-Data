import { useState } from 'react';
import { useAuth } from '../context/auth';
import { AccountsPage } from './AccountsPage';
import { BackupPage } from './BackupPage';

export function SystemAdminPage() {
  const { permissions } = useAuth();
  const [tab, setTab] = useState('accounts');
  if (!permissions.isVPAA) return <p className="empty-work">CCT System Administration is restricted to the VPAA.</p>;
  return <div className="page-stack space-y-6"><header><h1 className="workspace-title">CCT System Administration</h1><p className="workspace-subtitle">Accounts, access, backups, and recovery for the CCT administrator.</p></header>
    <div role="tablist" aria-label="System Admin modules" className="flex flex-wrap gap-3">
      {[['accounts','Accounts and Access'],['backup','Backup and Recovery']].map(([id,label])=><button key={id} id={`admin-tab-${id}`} role="tab" type="button" aria-selected={tab===id} aria-controls={`admin-panel-${id}`} className={tab===id?'primary-action':'control-lift'} onClick={()=>setTab(id)}>{label}</button>)}
    </div><section id={`admin-panel-${tab}`} role="tabpanel" aria-labelledby={`admin-tab-${tab}`}>{tab==='accounts'?<AccountsPage/>:<BackupPage/>}</section>
  </div>;
}
