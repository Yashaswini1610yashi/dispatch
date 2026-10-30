import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ClipboardList, Users, CalendarDays, RefreshCw,
  MapPinned, Zap, CheckCircle2, AlertTriangle, LogOut, Bell,
  Briefcase, Wrench, FileText, MessageSquare, Clock, X
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { request } from '../../lib/api';
import { clearAuth, getAuth } from '../../lib/auth';

const MENU = [
  ['Overview', LayoutDashboard], ['Jobs', ClipboardList], ['Technicians', Users],
  ['Schedule', CalendarDays], ['Recovery', RefreshCw], ['Services', Wrench],
  ['Recruitment', Briefcase], ['Complaints', MessageSquare], ['Leave', Clock],
  ['Audit Log', FileText], ['Notifications', Bell], ['Live Map', MapPinned],
] as const;

type Summary = {
  jobs_total: number; pending: number; assigned: number;
  in_progress: number; completed: number; unassigned: number;
  technicians_total: number; technicians_available: number; technicians_unavailable: number;
};

export default function AdminApp() {
  const nav = useNavigate();
  const auth = getAuth();
  const [tab, setTab] = useState('Overview');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [techs, setTechs] = useState<any[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [recruitment, setRecruitment] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [leaveReqs, setLeaveReqs] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function load() {
    try {
      const [s, j, t, r] = await Promise.all([
        request<Summary>('/api/dashboard/summary'),
        request<any[]>('/api/admin/jobs'),
        request<any[]>('/api/admin/technicians'),
        request<any[]>('/api/schedule/runs'),
      ]);
      setSummary(s); setJobs(j); setTechs(t); setRuns(r);
    } catch (e: any) { setError(e.message); }
  }

  useEffect(() => { load(); const id = setInterval(load, 20000); return () => clearInterval(id); }, []);

  useEffect(() => {
    if (tab === 'Services') request<any[]>('/api/admin/services').then(setServices).catch(() => {});
    if (tab === 'Recruitment') request<any[]>('/api/admin/recruitment').then(setRecruitment).catch(() => {});
    if (tab === 'Complaints') request<any[]>('/api/admin/complaints').then(setComplaints).catch(() => {});
    if (tab === 'Leave') request<any[]>('/api/admin/leave-requests').then(setLeaveReqs).catch(() => {});
    if (tab === 'Audit Log') request<any[]>('/api/admin/audit-logs').then(setAuditLogs).catch(() => {});
  }, [tab]);

  async function runScheduler() {
    setBusy(true); setNotice('');
    try {
      const r = await request<any>('/api/schedule/run', { method: 'POST' });
      setNotice(`Run ${r.run_id.slice(0, 8)} · ${r.jobs_assigned}/${r.jobs_considered} assigned`);
      load();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }

  async function runRecovery() {
    const first = techs.find(t => t.available);
    if (!first) { setError('No available technician for demo disruption'); return; }
    setBusy(true);
    try {
      const r = await request<any>('/api/schedule/recover', {
        method: 'POST',
        body: JSON.stringify({ type: 'technician_unavailable', technician_id: first.id, detail: 'Admin demo' })
      });
      setNotice(`Recovery · ${r.recovery.jobs_assigned} jobs re-assigned`);
      load();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }

  async function toggleTech(id: number, available: boolean) {
    await request(`/api/admin/technicians/${id}`, { method: 'PATCH', body: JSON.stringify({ available: !available }) });
    request<any[]>('/api/admin/technicians').then(setTechs);
  }

  async function recruitAction(id: number, action: string) {
    await request(`/api/admin/recruitment/${id}/action`, { method: 'POST', body: JSON.stringify({ action }) });
    request<any[]>('/api/admin/recruitment').then(setRecruitment);
    setNotice(`Application ${action}d`);
  }

  async function updateComplaint(id: number, status: string) {
    await request(`/api/admin/complaints/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
    request<any[]>('/api/admin/complaints').then(setComplaints);
  }

  async function updateLeave(id: number, status: string) {
    await request(`/api/admin/leave-requests/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
    request<any[]>('/api/admin/leave-requests').then(setLeaveReqs);
  }

  function logout() { clearAuth(); nav('/login'); }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brandmark"><Zap size={21} /></div>
          <div><b>dispatchgrid</b><small>ADMIN PORTAL</small></div>
        </div>
        <div className="workspace"><span className="dot" /> OPERATIONS CENTRE</div>
        <nav>
          {MENU.map(([label, Icon]) => (
            <button key={label} className={tab === label ? 'nav active' : 'nav'} onClick={() => setTab(label)}>
              <Icon size={16} />{label}
            </button>
          ))}
        </nav>
        <div className="side-bottom">
          <div className="avatar">{auth?.full_name?.[0] ?? 'A'}</div>
          <div><b>{auth?.full_name || 'Admin'}</b><small>Administrator</small></div>
          <button style={{ border: 0, background: 'none', color: '#91a0bd', cursor: 'pointer', marginLeft: 'auto' }} onClick={logout}><LogOut size={16} /></button>
        </div>
      </aside>

      <main className="main">
        <header>
          <div>
            <div className="eyebrow">DISPATCHGRID / {tab.toUpperCase()}</div>
            <h1>{tab === 'Overview' ? 'Operations Overview' : tab}</h1>
            <p>Intelligent field service scheduling and recovery.</p>
          </div>
          <div className="header-actions">
            <span className="live"><i /> System live</span>
            <button className="primary" onClick={runScheduler} disabled={busy}>
              <Zap size={15} />{busy ? 'Processing…' : 'Run Scheduler'}
            </button>
          </div>
        </header>

        {error && <div className="alert error">{error}<button onClick={() => setError('')}><X size={13} /></button></div>}
        {notice && <div className="alert success">{notice}<button onClick={() => setNotice('')}><X size={13} /></button></div>}

        {tab === 'Overview' && <>
          <div className="welcome">
            <div>
              <span className="pill">LIVE OPERATIONS</span>
              <h2>Welcome, {auth?.full_name?.split(' ')[0] || 'Admin'}.</h2>
              <p>Here's the latest pulse across your service network.</p>
            </div>
            <div className="welcome-right">
              <span>LAST SYNC</span><b>{new Date().toLocaleTimeString()}</b>
              <small>Auto-refresh every 20s</small>
            </div>
          </div>
          <div className="cards">
            {summary && [
              ['Total Jobs', summary.jobs_total, ClipboardList],
              ['Assigned', summary.assigned, CheckCircle2],
              ['Unassigned', summary.unassigned, AlertTriangle],
              ['Available Techs', summary.technicians_available, Users],
            ].map(([label, value, Icon]: any) => (
              <div className="stat" key={label as string}>
                <div className="stat-top"><span>{label}</span><Icon size={18} /></div>
                <strong>{value}</strong><small>Current network status</small>
              </div>
            ))}
          </div>
          <div className="grid">
            <section className="panel">
              <div className="panel-head"><div><h3>Job Distribution</h3><p>Workload by status</p></div><span className="muted-tag">LIVE</span></div>
              <div className="chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary ? [
                    { name: 'Pending', value: summary.pending },
                    { name: 'Assigned', value: summary.assigned },
                    { name: 'Working', value: summary.in_progress },
                    { name: 'Done', value: summary.completed },
                    { name: 'Unassigned', value: summary.unassigned },
                  ] : []}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf0f5" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#4169e1" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
            <section className="panel">
              <div className="panel-head"><div><h3>Technician Availability</h3><p>Resource readiness</p></div><Users size={18} /></div>
              <div className="availability">
                <strong>{summary?.technicians_available ?? 0}<small> / {summary?.technicians_total ?? 0}</small></strong>
                <div className="progress">
                  <span style={{ width: `${summary && summary.technicians_total ? summary.technicians_available / summary.technicians_total * 100 : 0}%` }} />
                </div>
                <div className="legend"><span><i className="green" /> Available</span><span><i className="grey" /> Unavailable</span></div>
              </div>
            </section>
          </div>
          <section className="panel table-panel">
            <div className="panel-head"><div><h3>Recent Jobs</h3><p>Prioritised by urgency</p></div>
              <button className="textbtn" onClick={() => setTab('Jobs')}>View all →</button>
            </div>
            <JobTable jobs={jobs.slice(0, 8)} />
          </section>
        </>}

        {tab === 'Jobs' && <section className="panel table-panel">
          <div className="panel-head"><div><h3>All Service Jobs</h3><p>{jobs.length} records</p></div></div>
          <JobTable jobs={jobs} />
        </section>}

        {tab === 'Technicians' && <section className="panel table-panel">
          <div className="panel-head"><div><h3>Technician Directory</h3><p>{techs.length} registered</p></div></div>
          <table><thead><tr><th>NAME</th><th>SKILLS</th><th>ZONES</th><th>RATING</th><th>JOBS</th><th>STATUS</th><th>ACTION</th></tr></thead>
            <tbody>{techs.map(t => (
              <tr key={t.id}>
                <td><b>{t.name}</b><small>{t.email}</small></td>
                <td>{(t.skills || []).join(', ')}</td>
                <td>{(t.zones || []).join(', ')}</td>
                <td>{t.rating?.toFixed(1)}</td>
                <td>{t.total_jobs}</td>
                <td><span className={`status ${t.available ? 'assigned' : 'unassigned'}`}>{t.available ? 'Available' : 'Unavailable'}</span></td>
                <td><button className="textbtn" onClick={() => toggleTech(t.id, t.available)}>{t.available ? 'Set Unavailable' : 'Set Available'}</button></td>
              </tr>
            ))}</tbody>
          </table>
        </section>}

        {tab === 'Schedule' && <section className="panel table-panel">
          <div className="panel-head"><div><h3>Current Schedule</h3><p>Active assignments</p></div>
            <button className="primary" onClick={runScheduler} disabled={busy}><Zap size={14} /> Run Optimisation</button>
          </div>
          <ScheduleTable />
        </section>}

        {tab === 'Recovery' && <section className="panel recovery">
          <div className="recovery-icon"><RefreshCw size={25} /></div>
          <h2>Disruption Recovery</h2>
          <p>Mark a technician unavailable and re-optimise. Completed and in-progress work is protected.</p>
          <button className="primary" onClick={runRecovery} disabled={busy}><RefreshCw size={14} /> Run Technician-Unavailable Scenario</button>
          <h3>Recent Scheduling Runs</h3>
          {runs.slice(0, 8).map(r => (
            <div className="runrow" key={r.run_id}>
              <div><b>{r.run_id.slice(0, 14)}</b><small>{new Date(r.created_at).toLocaleString()}</small></div>
              <span>{r.jobs_assigned}/{r.jobs_considered} assigned</span>
              <span className="muted-tag">Score {r.objective_score?.toFixed(1)}</span>
            </div>
          ))}
        </section>}

        {tab === 'Services' && <section className="panel table-panel">
          <div className="panel-head"><div><h3>Service Catalogue</h3><p>{services.length} services</p></div></div>
          <table><thead><tr><th>NAME</th><th>SKILL REQUIRED</th><th>BASE PRICE</th><th>DURATION</th><th>STATUS</th></tr></thead>
            <tbody>{services.map(s => (
              <tr key={s.id}>
                <td><b>{s.name}</b><small>{s.description}</small></td>
                <td>{s.skill_required}</td>
                <td>${s.base_price}</td>
                <td>{s.duration_minutes} min</td>
                <td><span className={`status ${s.active ? 'assigned' : 'cancelled'}`}>{s.active ? 'Active' : 'Inactive'}</span></td>
              </tr>
            ))}</tbody>
          </table>
        </section>}

        {tab === 'Recruitment' && <section className="panel table-panel">
          <div className="panel-head"><div><h3>Recruitment Applications</h3><p>{recruitment.length} applications</p></div></div>
          <table><thead><tr><th>APPLICANT</th><th>SKILLS</th><th>ZONES</th><th>STATUS</th><th>ACTIONS</th></tr></thead>
            <tbody>{recruitment.map(r => (
              <tr key={r.id}>
                <td><b>{r.full_name}</b><small>{r.email}</small></td>
                <td>{(r.skills || []).join(', ')}</td>
                <td>{(r.zones || []).join(', ')}</td>
                <td><span className={`status ${r.status === 'approve' ? 'assigned' : r.status === 'reject' ? 'cancelled' : 'pending'}`}>{r.status}</span></td>
                <td style={{ display: 'flex', gap: 6 }}>
                  {r.status === 'pending' && <>
                    <button className="textbtn" onClick={() => recruitAction(r.id, 'shortlist')}>Shortlist</button>
                    <button className="textbtn" style={{ color: '#25835d' }} onClick={() => recruitAction(r.id, 'approve')}>Approve</button>
                    <button className="textbtn" style={{ color: '#c05a49' }} onClick={() => recruitAction(r.id, 'reject')}>Reject</button>
                  </>}
                  {r.status === 'shortlist' && <>
                    <button className="textbtn" style={{ color: '#25835d' }} onClick={() => recruitAction(r.id, 'approve')}>Approve</button>
                    <button className="textbtn" style={{ color: '#c05a49' }} onClick={() => recruitAction(r.id, 'reject')}>Reject</button>
                  </>}
                </td>
              </tr>
            ))}</tbody>
          </table>
        </section>}

        {tab === 'Complaints' && <section className="panel table-panel">
          <div className="panel-head"><div><h3>Customer Complaints</h3><p>{complaints.length} total</p></div></div>
          <table><thead><tr><th>SUBJECT</th><th>CUSTOMER</th><th>STATUS</th><th>DATE</th><th>ACTION</th></tr></thead>
            <tbody>{complaints.map(c => (
              <tr key={c.id}>
                <td><b>{c.subject}</b><small>{c.description?.slice(0, 60)}</small></td>
                <td>#{c.customer_id}</td>
                <td><span className={`status ${c.status === 'resolved' ? 'assigned' : c.status === 'open' ? 'pending' : 'in_progress'}`}>{c.status}</span></td>
                <td>{new Date(c.created_at).toLocaleDateString()}</td>
                <td>
                  {c.status === 'open' && <button className="textbtn" onClick={() => updateComplaint(c.id, 'in_progress')}>Investigate</button>}
                  {c.status === 'in_progress' && <button className="textbtn" style={{ color: '#25835d' }} onClick={() => updateComplaint(c.id, 'resolved')}>Resolve</button>}
                </td>
              </tr>
            ))}</tbody>
          </table>
        </section>}

        {tab === 'Leave' && <section className="panel table-panel">
          <div className="panel-head"><div><h3>Leave Requests</h3><p>{leaveReqs.length} total</p></div></div>
          <table><thead><tr><th>TECHNICIAN</th><th>FROM</th><th>TO</th><th>REASON</th><th>STATUS</th><th>ACTION</th></tr></thead>
            <tbody>{leaveReqs.map(lr => (
              <tr key={lr.id}>
                <td><b>{lr.technician_name}</b></td>
                <td>{new Date(lr.start_date).toLocaleDateString()}</td>
                <td>{new Date(lr.end_date).toLocaleDateString()}</td>
                <td>{lr.reason || '—'}</td>
                <td><span className={`status ${lr.status === 'approved' ? 'assigned' : lr.status === 'rejected' ? 'cancelled' : 'pending'}`}>{lr.status}</span></td>
                <td style={{ display: 'flex', gap: 6 }}>
                  {lr.status === 'pending' && <>
                    <button className="textbtn" style={{ color: '#25835d' }} onClick={() => updateLeave(lr.id, 'approved')}>Approve</button>
                    <button className="textbtn" style={{ color: '#c05a49' }} onClick={() => updateLeave(lr.id, 'rejected')}>Reject</button>
                  </>}
                </td>
              </tr>
            ))}</tbody>
          </table>
        </section>}

        {tab === 'Audit Log' && <section className="panel table-panel">
          <div className="panel-head"><div><h3>Audit Log</h3><p>Last 50 system events</p></div></div>
          <table><thead><tr><th>ACTION</th><th>ENTITY</th><th>ID</th><th>TIMESTAMP</th></tr></thead>
            <tbody>{auditLogs.map(a => (
              <tr key={a.id}>
                <td><b>{a.action}</b></td>
                <td>{a.entity_type}</td>
                <td>{a.entity_id}</td>
                <td>{new Date(a.created_at).toLocaleString()}</td>
              </tr>
            ))}</tbody>
          </table>
        </section>}

        {tab === 'Notifications' && <NotificationsPanel />}

        {tab === 'Live Map' && <section className="panel recovery">
          <div className="recovery-icon"><MapPinned size={25} /></div>
          <h2>Live Technician Map</h2>
          <p>GPS coordinates are stored per technician. Connect Leaflet with a WebSocket stream to show real-time positions. GPS is only collected with technician consent during active job sessions.</p>
          <div className="map-placeholder"><MapPinned size={32} /><b>Map requires active GPS sessions</b><small>Enable technician tracking to see live positions.</small></div>
        </section>}

        <footer>DISPATCHGRID ADMIN · Explainable scheduling for field operations <span>v2.0</span></footer>
      </main>
    </div>
  );
}

function JobTable({ jobs }: { jobs: any[] }) {
  return (
    <table><thead><tr><th>JOB ID</th><th>TITLE</th><th>SKILLS</th><th>ZONE</th><th>PRIORITY</th><th>STATUS</th></tr></thead>
      <tbody>{jobs.map(j => (
        <tr key={j.id}>
          <td><b>{j.external_id}</b></td>
          <td>{j.title}</td>
          <td>{(j.required_skills || []).join(', ')}</td>
          <td>{j.zone}</td>
          <td><span className={`priority p${j.priority}`}>{['', 'Critical', 'High', 'Normal', 'Low', 'Lowest'][j.priority]}</span></td>
          <td><span className={`status ${j.status}`}>{j.status?.replace('_', ' ')}</span></td>
        </tr>
      ))}</tbody>
    </table>
  );
}

function ScheduleTable() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { request<any[]>('/api/schedule/current').then(setRows).catch(() => {}); }, []);
  return (
    <table><thead><tr><th>JOB</th><th>TECHNICIAN</th><th>START</th><th>END</th><th>TRAVEL</th><th>STATUS</th></tr></thead>
      <tbody>{rows.map((r, i) => (
        <tr key={i}>
          <td><b>{r.job_id}</b><small>{r.job_title}</small></td>
          <td>{r.technician_name}</td>
          <td>{new Date(r.start_at).toLocaleString()}</td>
          <td>{new Date(r.end_at).toLocaleString()}</td>
          <td>{r.travel_minutes} min</td>
          <td><span className="status assigned">{r.status}</span></td>
        </tr>
      ))}</tbody>
    </table>
  );
}

function NotificationsPanel() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [role, setRole] = useState('');
  const [sent, setSent] = useState<number | null>(null);

  async function broadcast() {
    const r = await request<any>('/api/admin/notifications/broadcast', {
      method: 'POST', body: JSON.stringify({ title, body, role: role || undefined })
    });
    setSent(r.sent); setTitle(''); setBody('');
  }

  return (
    <section className="panel" style={{ maxWidth: 560 }}>
      <div className="panel-head"><div><h3>Broadcast Notification</h3><p>Send to all users or by role</p></div></div>
      {sent !== null && <div className="alert success">Sent to {sent} users. <button onClick={() => setSent(null)}><X size={12} /></button></div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input placeholder="Title" value={title} onChange={e => setTitle(e.target.value)}
          style={{ border: '1.5px solid #e3e8f0', borderRadius: 8, padding: '10px 12px', fontSize: 13 }} />
        <textarea placeholder="Message body" value={body} onChange={e => setBody(e.target.value)} rows={3}
          style={{ border: '1.5px solid #e3e8f0', borderRadius: 8, padding: '10px 12px', fontSize: 13, resize: 'vertical' }} />
        <select value={role} onChange={e => setRole(e.target.value)}
          style={{ border: '1.5px solid #e3e8f0', borderRadius: 8, padding: '10px 12px', fontSize: 13 }}>
          <option value="">All users</option>
          <option value="customer">Customers only</option>
          <option value="technician">Technicians only</option>
        </select>
        <button className="primary" onClick={broadcast} disabled={!title}><Bell size={14} /> Send Notification</button>
      </div>
    </section>
  );
}
