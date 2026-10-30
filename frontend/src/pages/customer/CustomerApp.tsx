import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, CalendarDays, ClipboardList, Bell, FileText,
  MessageSquare, User, LogOut, Zap, Plus, X, CheckCircle2, Clock
} from 'lucide-react';
import { request } from '../../lib/api';
import { clearAuth, getAuth } from '../../lib/auth';

const MENU = [
  ['Overview', LayoutDashboard], ['Book a Service', Plus], ['My Bookings', CalendarDays],
  ['Notifications', Bell], ['Complaints', MessageSquare], ['Invoices', FileText], ['Profile', User],
] as const;

export default function CustomerApp() {
  const nav = useNavigate();
  const auth = getAuth();
  const [tab, setTab] = useState('Overview');
  const [bookings, setBookings] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);

  async function load() {
    try {
      const [b, n, c, i] = await Promise.all([
        request<any[]>('/api/customer/bookings'),
        request<any[]>('/api/customer/notifications'),
        request<any[]>('/api/customer/complaints'),
        request<any[]>('/api/customer/invoices'),
      ]);
      setBookings(b); setNotifications(n); setComplaints(c); setInvoices(i);
      setUnread(n.filter((x: any) => !x.read).length);
    } catch {}
  }

  useEffect(() => { load(); }, []);

  async function markRead(id: number) {
    await request(`/api/customer/notifications/${id}/read`, { method: 'POST' });
    load();
  }

  function logout() { clearAuth(); nav('/login'); }

  const upcoming = bookings.filter(b => ['pending', 'assigned', 'in_progress'].includes(b.status));
  const completed = bookings.filter(b => b.status === 'completed');
  const cancelled = bookings.filter(b => b.status === 'cancelled');

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brandmark"><Zap size={21} /></div>
          <div><b>dispatchgrid</b><small>CUSTOMER PORTAL</small></div>
        </div>
        <div className="workspace"><span className="dot" /> HOME SERVICES</div>
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
          <div className="avatar">{auth?.full_name?.[0] ?? 'C'}</div>
          <div><b>{auth?.full_name || 'Customer'}</b><small>Customer account</small></div>
          <button style={{ border: 0, background: 'none', color: '#91a0bd', cursor: 'pointer', marginLeft: 'auto' }} onClick={logout}><LogOut size={16} /></button>
        </div>
      </aside>

      <main className="main">
        <header>
          <div>
            <div className="eyebrow">DISPATCHGRID / {tab.toUpperCase()}</div>
            <h1>{tab}</h1>
            <p>Your home services, managed intelligently.</p>
          </div>
        </header>

        {tab === 'Overview' && <>
          <div className="welcome">
            <div>
              <span className="pill">MY SERVICES</span>
              <h2>Hello, {auth?.full_name?.split(' ')[0] || 'there'}!</h2>
              <p>Track your bookings and manage your home services.</p>
            </div>
            <div className="welcome-right">
              <span>BOOKINGS</span><b>{bookings.length}</b><small>Total bookings</small>
            </div>
          </div>
          <div className="cards">
            {[
              ['Upcoming', upcoming.length, CalendarDays],
              ['Completed', completed.length, CheckCircle2],
              ['Cancelled', cancelled.length, X],
              ['Unread Alerts', unread, Bell],
            ].map(([label, value, Icon]: any) => (
              <div className="stat" key={label}>
                <div className="stat-top"><span>{label}</span><Icon size={18} /></div>
                <strong>{value}</strong><small>Your account</small>
              </div>
            ))}
          </div>
          {upcoming.length > 0 && <section className="panel table-panel">
            <div className="panel-head"><div><h3>Upcoming Services</h3><p>Active bookings</p></div>
              <button className="textbtn" onClick={() => setTab('My Bookings')}>View all →</button>
            </div>
            <BookingTable bookings={upcoming.slice(0, 5)} />
          </section>}
          {upcoming.length === 0 && <section className="panel recovery">
            <div className="recovery-icon"><CalendarDays size={25} /></div>
            <h2>No upcoming services</h2>
            <p>Book a home service and our intelligent scheduling engine will assign the best available technician.</p>
            <button className="primary" onClick={() => setTab('Book a Service')}><Plus size={14} /> Book a Service</button>
          </section>}
        </>}

        {tab === 'Book a Service' && <BookingWizard onDone={() => { load(); setTab('My Bookings'); }} />}

        {tab === 'My Bookings' && <section className="panel table-panel">
          <div className="panel-head"><div><h3>My Bookings</h3><p>{bookings.length} total</p></div>
            <button className="primary" onClick={() => setTab('Book a Service')}><Plus size={14} /> New Booking</button>
          </div>
          <BookingTable bookings={bookings} />
        </section>}

        {tab === 'Notifications' && <section className="panel table-panel">
          <div className="panel-head"><div><h3>Notifications</h3><p>{unread} unread</p></div></div>
          {notifications.length === 0 && <p style={{ color: '#9aa4b3', fontSize: 13, padding: '20px 0' }}>No notifications yet.</p>}
          {notifications.map(n => (
            <div key={n.id} style={{ padding: '14px 0', borderBottom: '1px solid #f0f2f6', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: n.read ? '#d0d7e3' : '#4169e1', marginTop: 5, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#1a2944' }}>{n.title}</div>
                <div style={{ fontSize: 11, color: '#7d899d', marginTop: 3 }}>{n.body}</div>
                <div style={{ fontSize: 9, color: '#a0a9b6', marginTop: 4 }}>{new Date(n.created_at).toLocaleString()}</div>
              </div>
              {!n.read && <button className="textbtn" onClick={() => markRead(n.id)}>Mark read</button>}
            </div>
          ))}
        </section>}

        {tab === 'Complaints' && <ComplaintsPanel complaints={complaints} onRefresh={load} />}

        {tab === 'Invoices' && <section className="panel table-panel">
          <div className="panel-head"><div><h3>Invoices</h3><p>{invoices.length} total</p></div></div>
          {invoices.length === 0 && <p style={{ color: '#9aa4b3', fontSize: 13, padding: '20px 0' }}>No invoices yet.</p>}
          <table><thead><tr><th>REF</th><th>AMOUNT</th><th>STATUS</th><th>DATE</th></tr></thead>
            <tbody>{invoices.map(i => (
              <tr key={i.id}>
                <td><b>{i.invoice_ref}</b></td>
                <td>${i.amount.toFixed(2)}</td>
                <td><span className={`status ${i.status === 'paid' ? 'assigned' : 'pending'}`}>{i.status}</span></td>
                <td>{new Date(i.created_at).toLocaleDateString()}</td>
              </tr>
            ))}</tbody>
          </table>
        </section>}

        {tab === 'Profile' && <ProfilePanel />}

        <footer>DISPATCHGRID · Home services platform <span>v2.0</span></footer>
      </main>
    </div>
  );
}

function BookingTable({ bookings }: { bookings: any[] }) {
  return (
    <table><thead><tr><th>REF</th><th>ADDRESS</th><th>URGENCY</th><th>SERVICES</th><th>STATUS</th><th>DATE</th></tr></thead>
      <tbody>{bookings.map(b => (
        <tr key={b.id}>
          <td><b>{b.booking_ref}</b></td>
          <td>{b.address?.slice(0, 40)}</td>
          <td><span className={`priority p${b.urgency === 'urgent' ? 1 : b.urgency === 'high' ? 2 : 3}`}>{b.urgency}</span></td>
          <td>{b.jobs?.length ?? 0} job(s)</td>
          <td><span className={`status ${b.status}`}>{b.status}</span></td>
          <td>{new Date(b.created_at).toLocaleDateString()}</td>
        </tr>
      ))}</tbody>
    </table>
  );
}

function BookingWizard({ onDone }: { onDone: () => void }) {
  const [services, setServices] = useState<any[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [address, setAddress] = useState('');
  const [urgency, setUrgency] = useState('normal');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { request<any[]>('/api/customer/services').then(setServices).catch(() => {}); }, []);

  function toggleService(id: number) {
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  }

  async function submit() {
    if (!address.trim()) { setError('Please enter your address'); return; }
    if (selected.length === 0) { setError('Please select at least one service'); return; }
    setBusy(true); setError('');
    try {
      await request('/api/customer/bookings', {
        method: 'POST',
        body: JSON.stringify({ address, urgency, notes, services: selected.map(id => ({ service_id: id })) })
      });
      onDone();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }

  return (
    <section className="panel" style={{ maxWidth: 640 }}>
      <div className="panel-head"><div><h3>Book a Service</h3><p>Select services and provide your details</p></div></div>
      {error && <div className="alert error">{error}<button onClick={() => setError('')}><X size={12} /></button></div>}

      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 10, letterSpacing: .8, color: '#8090a8', fontWeight: 700, display: 'block', marginBottom: 10 }}>SELECT SERVICES</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {services.map(s => (
            <div key={s.id} onClick={() => toggleService(s.id)}
              style={{ border: `2px solid ${selected.includes(s.id) ? '#4169e1' : '#e3e8f0'}`, borderRadius: 10, padding: '14px 16px', cursor: 'pointer', background: selected.includes(s.id) ? '#eef2ff' : '#fff', transition: 'all .15s' }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#1a2944' }}>{s.name}</div>
              <div style={{ fontSize: 11, color: '#7d899d', marginTop: 3 }}>{s.description}</div>
              <div style={{ fontSize: 10, color: '#4169e1', marginTop: 6, fontWeight: 600 }}>${s.base_price} · {s.duration_minutes} min</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 10, letterSpacing: .8, color: '#8090a8', fontWeight: 700, display: 'block', marginBottom: 6 }}>SERVICE ADDRESS</label>
        <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Enter your full address"
          style={{ width: '100%', border: '1.5px solid #e3e8f0', borderRadius: 8, padding: '11px 13px', fontSize: 13, boxSizing: 'border-box' }} />
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 10, letterSpacing: .8, color: '#8090a8', fontWeight: 700, display: 'block', marginBottom: 6 }}>URGENCY</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {[['normal', 'Normal'], ['high', 'High'], ['urgent', 'Urgent']].map(([v, l]) => (
            <button key={v} type="button" onClick={() => setUrgency(v)}
              style={{ flex: 1, border: `2px solid ${urgency === v ? '#4169e1' : '#e3e8f0'}`, borderRadius: 8, padding: '9px 0', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: urgency === v ? '#eef2ff' : '#fff', color: urgency === v ? '#4169e1' : '#6c7890' }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 10, letterSpacing: .8, color: '#8090a8', fontWeight: 700, display: 'block', marginBottom: 6 }}>NOTES (OPTIONAL)</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Describe the problem…" rows={3}
          style={{ width: '100%', border: '1.5px solid #e3e8f0', borderRadius: 8, padding: '11px 13px', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
      </div>

      <button className="primary" onClick={submit} disabled={busy} style={{ width: '100%', justifyContent: 'center' }}>
        {busy ? 'Submitting…' : 'Confirm Booking'}
      </button>
    </section>
  );
}

function ComplaintsPanel({ complaints, onRefresh }: { complaints: any[]; onRefresh: () => void }) {
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!subject.trim()) return;
    setBusy(true);
    try {
      await request('/api/customer/complaints', { method: 'POST', body: JSON.stringify({ subject, description }) });
      setSubject(''); setDescription(''); onRefresh();
    } finally { setBusy(false); }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <section className="panel">
        <div className="panel-head"><div><h3>Submit a Complaint</h3></div></div>
        <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject"
          style={{ width: '100%', border: '1.5px solid #e3e8f0', borderRadius: 8, padding: '10px 12px', fontSize: 13, marginBottom: 10, boxSizing: 'border-box' }} />
        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe your issue…" rows={4}
          style={{ width: '100%', border: '1.5px solid #e3e8f0', borderRadius: 8, padding: '10px 12px', fontSize: 13, resize: 'vertical', marginBottom: 12, boxSizing: 'border-box' }} />
        <button className="primary" onClick={submit} disabled={busy || !subject}>Submit Complaint</button>
      </section>
      <section className="panel table-panel">
        <div className="panel-head"><div><h3>My Complaints</h3><p>{complaints.length} total</p></div></div>
        {complaints.length === 0 && <p style={{ color: '#9aa4b3', fontSize: 13 }}>No complaints submitted.</p>}
        {complaints.map(c => (
          <div key={c.id} style={{ padding: '12px 0', borderBottom: '1px solid #f0f2f6' }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#1a2944' }}>{c.subject}</div>
            <div style={{ display: 'flex', gap: 10, marginTop: 5 }}>
              <span className={`status ${c.status === 'resolved' ? 'assigned' : c.status === 'open' ? 'pending' : 'in_progress'}`}>{c.status}</span>
              <span style={{ fontSize: 9, color: '#a0a9b6' }}>{new Date(c.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

function ProfilePanel() {
  const auth = getAuth();
  const [fullName, setFullName] = useState(auth?.full_name || '');
  const [phone, setPhone] = useState('');
  const [saved, setSaved] = useState(false);

  async function save() {
    await request('/api/auth/me', { method: 'PATCH', body: JSON.stringify({ full_name: fullName, phone }) });
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  }

  return (
    <section className="panel" style={{ maxWidth: 480 }}>
      <div className="panel-head"><div><h3>My Profile</h3></div></div>
      {saved && <div className="alert success">Profile updated.</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={{ fontSize: 10, letterSpacing: .8, color: '#8090a8', fontWeight: 700, display: 'block', marginBottom: 6 }}>EMAIL</label>
          <input value={auth?.email || ''} disabled style={{ width: '100%', border: '1.5px solid #e3e8f0', borderRadius: 8, padding: '10px 12px', fontSize: 13, background: '#f7f9fc', boxSizing: 'border-box' }} />
        </div>
        <div>
          <label style={{ fontSize: 10, letterSpacing: .8, color: '#8090a8', fontWeight: 700, display: 'block', marginBottom: 6 }}>FULL NAME</label>
          <input value={fullName} onChange={e => setFullName(e.target.value)} style={{ width: '100%', border: '1.5px solid #e3e8f0', borderRadius: 8, padding: '10px 12px', fontSize: 13, boxSizing: 'border-box' }} />
        </div>
        <div>
          <label style={{ fontSize: 10, letterSpacing: .8, color: '#8090a8', fontWeight: 700, display: 'block', marginBottom: 6 }}>PHONE</label>
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Your phone number" style={{ width: '100%', border: '1.5px solid #e3e8f0', borderRadius: 8, padding: '10px 12px', fontSize: 13, boxSizing: 'border-box' }} />
        </div>
        <button className="primary" onClick={save}>Save Changes</button>
      </div>
    </section>
  );
}
