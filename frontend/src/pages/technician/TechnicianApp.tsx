import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ClipboardList, CalendarDays, Bell, LogOut,
  Zap, CheckCircle2, Clock, AlertTriangle, User, X, MapPin
} from 'lucide-react';
import { request } from '../../lib/api';
import { clearAuth, getAuth } from '../../lib/auth';

const MENU = [
  ['Dashboard', LayoutDashboard], ['My Assignments', ClipboardList],
  ['Availability', CheckCircle2], ['Leave Requests', CalendarDays],
  ['Emergency', AlertTriangle], ['Notifications', Bell], ['Profile', User],
] as const;

export default function TechnicianApp() {
  const nav = useNavigate();
  const auth = getAuth();
  const [tab, setTab] = useState('Dashboard');
  const [profile, setProfile] = useState<any>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [leaveReqs, setLeaveReqs] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function load() {
    try {
      const [p, a, h, n, l] = await Promise.all([
        request<any>('/api/technician/profile'),
        request<any[]>('/api/technician/assignments'),
        request<any[]>('/api/technician/history'),
        request<any[]>('/api/technician/notifications'),
        request<any[]>('/api/technician/leave'),
      ]);
      setProfile(p); setAssignments(a); setHistory(h); setNotifications(n); setLeaveReqs(l);
      setUnread(n.filter((x: any) => !x.read).length);
    } catch (e: any) { setError(e.message); }
  }

  useEffect(() => { load(); }, []);

  async function toggleAvailability() {
    await request('/api/technician/availability', { method: 'PATCH', body: JSON.stringify({ available: !profile?.available }) });
    setNotice(profile?.available ? 'You are now unavailable' : 'You are now available');
    load();
  }

  async function updateStatus(aid: number, status: string) {
    try {
      await request(`/api/technician/assignments/${aid}/status`, { method: 'POST', body: JSON.stringify({ status }) });
      setNotice(`Job marked as ${status.replace('_', ' ')}`);
      load();
    } catch (e: any) { setError(e.message); }
  }

  async function submitLeave(start: string, end: string, reason: string) {
    await request('/api/technician/leave', { method: 'POST', body: JSON.stringify({ start_date: start, end_date: end, reason }) });
    setNotice('Leave request submitted'); load();
  }

  async function reportEmergency(message: string) {
    await request('/api/technician/emergency', { method: 'POST', body: JSON.stringify({ message }) });
    setNotice('Emergency reported to admin');
  }

  function logout() { clearAuth(); nav('/login'); }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brandmark"><Zap size={21} /></div>
          <div><b>dispatchgrid</b><small>TECHNICIAN PORTAL</small></div>
        </div>
        <div className="workspace">
          <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: profile?.available ? '#41d3a2' : '#e07b39', marginRight: 7 }} />
          {profile?.available ? 'AVAILABLE' : 'UNAVAILABLE'}
        </div>
        <nav>
          {MENU.map(([label, Icon]) => (
            <button key={label} className={tab === label ? 'nav active' : 'nav'} onClick={() => setTab(label)}>
              <Icon size={16} />
              {label}
              {label === 'Notifications' && unread > 0 && (
                <span style={{ marginLeft: 'auto', background: '#e07b39', color: '#fff', borderRadius: 10, fontSize: 9, padding: '2px 6px', fontWeight: 700 }}>{unread}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="side-bottom">
          <div className="avatar">{auth?.full_name?.[0] ?? 'T'}</div>
          <div><b>{auth?.full_name || 'Technician'}</b><small>Field technician</small></div>
          <button style={{ border: 0, background: 'none', color: '#91a0bd', cursor: 'pointer', marginLeft: 'auto' }} onClick={logout}><LogOut size={16} /></button>
        </div>
      </aside>

      <main className="main">
        <header>
          <div>
            <div className="eyebrow">DISPATCHGRID / {tab.toUpperCase()}</div>
            <h1>{tab}</h1>
            <p>Your assignments and schedule.</p>
          </div>
          <div className="header-actions">
            <button onClick={toggleAvailability}
              style={{ border: `2px solid ${profile?.available ? '#25b77a' : '#e07b39'}`, borderRadius: 9, background: profile?.available ? '#e8f7ef' : '#fff5ef', color: profile?.available ? '#25835d' : '#c05a49', padding: '9px 14px', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
              {profile?.available ? 'Set Unavailable' : 'Set Available'}
            </button>
          </div>
        </header>

        {error && <div className="alert error">{error}<button onClick={() => setError('')}><X size={13} /></button></div>}
        {notice && <div className="alert success">{notice}<button onClick={() => setNotice('')}><X size={13} /></button></div>}

        {tab === 'Dashboard' && <>
          <div className="welcome">
            <div>
              <span className="pill">MY WORKDAY</span>
              <h2>Hello, {auth?.full_name?.split(' ')[0] || 'Technician'}!</h2>
              <p>You have {assignments.length} active assignment{assignments.length !== 1 ? 's' : ''} today.</p>
            </div>
            <div className="welcome-right">
              <span>TOTAL JOBS</span><b>{profile?.total_jobs ?? 0}</b><small>Completed</small>
            </div>
          </div>
          <div className="cards">
            {[
              ['Active Jobs', assignments.length, ClipboardList],
              ['Completed', history.filter(h => h.status === 'completed').length, CheckCircle2],
              ['Rating', profile?.rating?.toFixed(1) ?? '—', User],
              ['Unread', unread, Bell],
            ].map(([label, value, Icon]: any) => (
              <div className="stat" key={label}>
                <div className="stat-top"><span>{label}</span><Icon size={18} /></div>
                <strong>{value}</strong><small>Your stats</small>
              </div>
            ))}
          </div>
          {assignments.length > 0 && <section className="panel table-panel">
            <div className="panel-head"><div><h3>Today's Assignments</h3></div>
              <button className="textbtn" onClick={() => setTab('My Assignments')}>View all →</button>
            </div>
            <AssignmentTable assignments={assignments.slice(0, 5)} onUpdate={updateStatus} />
          </section>}
          {assignments.length === 0 && <section className="panel recovery">
            <div className="recovery-icon"><ClipboardList size={25} /></div>
            <h2>No active assignments</h2>
            <p>Make sure you are set as available so the scheduling engine can assign jobs to you.</p>
          </section>}
        </>}

        {tab === 'My Assignments' && <section className="panel table-panel">
          <div className="panel-head"><div><h3>Active Assignments</h3><p>{assignments.length} jobs</p></div></div>
          <AssignmentTable assignments={assignments} onUpdate={updateStatus} />
          {history.length > 0 && <>
            <div className="panel-head" style={{ marginTop: 24 }}><div><h3>Job History</h3><p>{history.length} completed</p></div></div>
            <table><thead><tr><th>JOB</th><th>TITLE</th><th>START</th><th>END</th><th>STATUS</th></tr></thead>
              <tbody>{history.map(h => (
                <tr key={h.id}>
                  <td><b>{h.job_external_id}</b></td>
                  <td>{h.job_title}</td>
                  <td>{new Date(h.start_at).toLocaleString()}</td>
                  <td>{new Date(h.end_at).toLocaleString()}</td>
                  <td><span className={`status ${h.status}`}>{h.status}</span></td>
                </tr>
              ))}</tbody>
            </table>
          </>}
        </section>}

        {tab === 'Availability' && profile && <section className="panel" style={{ maxWidth: 480 }}>
          <div className="panel-head"><div><h3>Availability Settings</h3></div></div>
          <div style={{ padding: '20px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid #f0f2f6' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#1a2944' }}>Current Status</div>
                <div style={{ fontSize: 12, color: '#7d899d', marginTop: 3 }}>Toggle your availability for new job assignments</div>
              </div>
              <span className={`status ${profile.available ? 'assigned' : 'unassigned'}`} style={{ fontSize: 12, padding: '7px 12px' }}>
                {profile.available ? 'Available' : 'Unavailable'}
              </span>
            </div>
            <div style={{ padding: '16px 0', borderBottom: '1px solid #f0f2f6' }}>
              <div style={{ fontSize: 10, letterSpacing: .8, color: '#8090a8', fontWeight: 700, marginBottom: 8 }}>SHIFT HOURS</div>
              <div style={{ fontSize: 14, color: '#1a2944', fontWeight: 600 }}>{profile.shift_start} – {profile.shift_end}</div>
            </div>
            <div style={{ padding: '16px 0' }}>
              <div style={{ fontSize: 10, letterSpacing: .8, color: '#8090a8', fontWeight: 700, marginBottom: 8 }}>SERVICE ZONES</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(profile.zones || []).map((z: string) => (
                  <span key={z} style={{ background: '#eef2ff', color: '#4169e1', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600 }}>{z}</span>
                ))}
              </div>
            </div>
            <button className="primary" onClick={toggleAvailability} style={{ marginTop: 8 }}>
              {profile.available ? 'Go Unavailable' : 'Go Available'}
            </button>
          </div>
        </section>}

        {tab === 'Leave Requests' && <LeavePanel leaveReqs={leaveReqs} onSubmit={submitLeave} />}

        {tab === 'Emergency' && <EmergencyPanel onReport={reportEmergency} />}

        {tab === 'Notifications' && <section className="panel table-panel">
          <div className="panel-head"><div><h3>Notifications</h3><p>{unread} unread</p></div></div>
          {notifications.length === 0 && <p style={{ color: '#9aa4b3', fontSize: 13, padding: '20px 0' }}>No notifications.</p>}
          {notifications.map(n => (
            <div key={n.id} style={{ padding: '14px 0', borderBottom: '1px solid #f0f2f6', display: 'flex', gap: 14 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: n.read ? '#d0d7e3' : '#4169e1', marginTop: 5, flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#1a2944' }}>{n.title}</div>
                <div style={{ fontSize: 11, color: '#7d899d', marginTop: 3 }}>{n.body}</div>
                <div style={{ fontSize: 9, color: '#a0a9b6', marginTop: 4 }}>{new Date(n.created_at).toLocaleString()}</div>
              </div>
            </div>
          ))}
        </section>}

        {tab === 'Profile' && profile && <section className="panel" style={{ maxWidth: 480 }}>
          <div className="panel-head"><div><h3>My Profile</h3></div></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[['Name', profile.name], ['Email', profile.email], ['Phone', profile.phone || '—'], ['Skills', (profile.skills || []).join(', ')], ['Zones', (profile.zones || []).join(', ')], ['Rating', profile.rating?.toFixed(1)], ['Total Jobs', profile.total_jobs]].map(([label, value]) => (
              <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f0f2f6' }}>
                <span style={{ fontSize: 11, color: '#8090a8', fontWeight: 700, letterSpacing: .5 }}>{label}</span>
                <span style={{ fontSize: 13, color: '#1a2944', fontWeight: 600 }}>{value}</span>
              </div>
            ))}
          </div>
        </section>}

        <footer>DISPATCHGRID · Technician portal <span>v2.0</span></footer>
      </main>
    </div>
  );
}

function AssignmentTable({ assignments, onUpdate }: { assignments: any[]; onUpdate: (id: number, status: string) => void }) {
  if (assignments.length === 0) return <p style={{ color: '#9aa4b3', fontSize: 13, padding: '20px 0' }}>No active assignments.</p>;
  return (
    <table><thead><tr><th>JOB</th><th>TITLE</th><th>ZONE</th><th>START</th><th>TRAVEL</th><th>STATUS</th><th>ACTION</th></tr></thead>
      <tbody>{assignments.map(a => (
        <tr key={a.id}>
          <td><b>{a.job_external_id}</b></td>
          <td>{a.job_title}</td>
          <td><span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={11} />{a.zone}</span></td>
          <td>{new Date(a.start_at).toLocaleString()}</td>
          <td>{a.travel_minutes} min</td>
          <td><span className={`status ${a.status}`}>{a.status?.replace('_', ' ')}</span></td>
          <td>
            {a.status === 'assigned' && <button className="textbtn" onClick={() => onUpdate(a.id, 'in_progress')}>Start Job</button>}
            {a.status === 'in_progress' && <button className="textbtn" style={{ color: '#25835d' }} onClick={() => onUpdate(a.id, 'completed')}>Complete</button>}
          </td>
        </tr>
      ))}</tbody>
    </table>
  );
}

function LeavePanel({ leaveReqs, onSubmit }: { leaveReqs: any[]; onSubmit: (s: string, e: string, r: string) => void }) {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [reason, setReason] = useState('');

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <section className="panel">
        <div className="panel-head"><div><h3>Request Leave</h3></div></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 10, letterSpacing: .8, color: '#8090a8', fontWeight: 700, display: 'block', marginBottom: 6 }}>START DATE</label>
            <input type="date" value={start} onChange={e => setStart(e.target.value)}
              style={{ width: '100%', border: '1.5px solid #e3e8f0', borderRadius: 8, padding: '10px 12px', fontSize: 13, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 10, letterSpacing: .8, color: '#8090a8', fontWeight: 700, display: 'block', marginBottom: 6 }}>END DATE</label>
            <input type="date" value={end} onChange={e => setEnd(e.target.value)}
              style={{ width: '100%', border: '1.5px solid #e3e8f0', borderRadius: 8, padding: '10px 12px', fontSize: 13, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 10, letterSpacing: .8, color: '#8090a8', fontWeight: 700, display: 'block', marginBottom: 6 }}>REASON</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
              style={{ width: '100%', border: '1.5px solid #e3e8f0', borderRadius: 8, padding: '10px 12px', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
          </div>
          <button className="primary" onClick={() => onSubmit(start, end, reason)} disabled={!start || !end}>Submit Request</button>
        </div>
      </section>
      <section className="panel table-panel">
        <div className="panel-head"><div><h3>My Leave Requests</h3></div></div>
        {leaveReqs.length === 0 && <p style={{ color: '#9aa4b3', fontSize: 13 }}>No leave requests.</p>}
        {leaveReqs.map(lr => (
          <div key={lr.id} style={{ padding: '12px 0', borderBottom: '1px solid #f0f2f6' }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#1a2944' }}>{new Date(lr.start_date).toLocaleDateString()} – {new Date(lr.end_date).toLocaleDateString()}</div>
            <div style={{ fontSize: 11, color: '#7d899d', marginTop: 3 }}>{lr.reason || 'No reason provided'}</div>
            <span className={`status ${lr.status === 'approved' ? 'assigned' : lr.status === 'rejected' ? 'cancelled' : 'pending'}`} style={{ marginTop: 6, display: 'inline-block' }}>{lr.status}</span>
          </div>
        ))}
      </section>
    </div>
  );
}

function EmergencyPanel({ onReport }: { onReport: (msg: string) => void }) {
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  async function submit() {
    await onReport(message);
    setSent(true); setMessage('');
  }

  return (
    <section className="panel recovery" style={{ maxWidth: 520 }}>
      <div className="recovery-icon" style={{ background: '#fff0ed', color: '#c05a49' }}><AlertTriangle size={25} /></div>
      <h2>Report Emergency</h2>
      <p>Use this only for genuine on-site emergencies. Your message will be sent immediately to the operations team.</p>
      {sent && <div className="alert success">Emergency reported. Admin has been notified.</div>}
      <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Describe the emergency situation…" rows={4}
        style={{ width: '100%', border: '1.5px solid #e3e8f0', borderRadius: 8, padding: '11px 13px', fontSize: 13, resize: 'vertical', marginBottom: 14, boxSizing: 'border-box' }} />
      <button onClick={submit} disabled={!message}
        style={{ border: 0, borderRadius: 9, background: '#c05a49', color: '#fff', padding: '12px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
        <AlertTriangle size={15} /> Report Emergency
      </button>
    </section>
  );
}
