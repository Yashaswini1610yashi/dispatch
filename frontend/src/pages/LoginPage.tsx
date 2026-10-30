import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Mail, Lock, User, Phone, AlertCircle } from 'lucide-react';
import { loginApi, registerApi, saveAuth } from '../lib/auth';

export default function LoginPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [role, setRole] = useState('customer');
  const [form, setForm] = useState({ email: '', password: '', full_name: '', phone: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const auth = mode === 'login'
        ? await loginApi(form.email, form.password)
        : await registerApi({ ...form, role });
      saveAuth(auth);
      if (auth.role === 'admin') nav('/admin');
      else if (auth.role === 'technician') nav('/technician');
      else nav('/customer');
    } catch (e: any) {
      setErr(e?.response?.data?.detail || e?.message || 'Authentication failed');
    } finally { setBusy(false); }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#0f1c33,#1a3260)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans',sans-serif" }}>
      <div style={{ width: 420, background: '#fff', borderRadius: 18, padding: '40px 36px', boxShadow: '0 24px 60px #00000040' }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: '#4169e1', display: 'grid', placeItems: 'center', color: '#fff' }}><Zap size={20} /></div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17, letterSpacing: -0.5, color: '#111d35' }}>dispatchgrid</div>
            <div style={{ fontSize: 8, letterSpacing: 1.3, color: '#8e9dbb' }}>WORKFORCE INTELLIGENCE</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', background: '#f1f4f9', borderRadius: 9, padding: 4, marginBottom: 24 }}>
          {(['login', 'register'] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); setErr(''); }}
              style={{ flex: 1, border: 0, borderRadius: 7, padding: '9px 0', fontWeight: 600, fontSize: 12, cursor: 'pointer', background: mode === m ? '#fff' : 'transparent', color: mode === m ? '#1a2944' : '#8090a8', boxShadow: mode === m ? '0 2px 8px #0002' : 'none', transition: 'all .15s' }}>
              {m === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          ))}
        </div>

        <form onSubmit={submit}>
          {mode === 'register' && (
            <>
              <Field icon={<User size={15} />} placeholder="Full name" value={form.full_name} onChange={v => set('full_name', v)} />
              <Field icon={<Phone size={15} />} placeholder="Phone (optional)" value={form.phone} onChange={v => set('phone', v)} />
              {/* Role selector */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 10, letterSpacing: .8, color: '#8090a8', fontWeight: 700, display: 'block', marginBottom: 6 }}>ACCOUNT TYPE</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[['customer', 'Customer'], ['technician', 'Technician']].map(([v, l]) => (
                    <button type="button" key={v} onClick={() => setRole(v)}
                      style={{ flex: 1, border: `2px solid ${role === v ? '#4169e1' : '#e3e8f0'}`, borderRadius: 8, padding: '9px 0', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: role === v ? '#eef2ff' : '#fff', color: role === v ? '#4169e1' : '#6c7890' }}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
          <Field icon={<Mail size={15} />} placeholder="Email address" type="email" value={form.email} onChange={v => set('email', v)} />
          <Field icon={<Lock size={15} />} placeholder="Password" type="password" value={form.password} onChange={v => set('password', v)} />

          {err && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff0ed', color: '#b34b3e', borderRadius: 8, padding: '10px 12px', fontSize: 12, marginBottom: 14 }}>
              <AlertCircle size={14} /> {err}
            </div>
          )}

          <button type="submit" disabled={busy}
            style={{ width: '100%', border: 0, borderRadius: 9, background: '#4169e1', color: '#fff', padding: '13px 0', fontWeight: 700, fontSize: 13, cursor: busy ? 'wait' : 'pointer', opacity: busy ? .7 : 1, marginTop: 4 }}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        {/* Demo credentials */}
        <div style={{ marginTop: 22, padding: '14px 16px', background: '#f7f9fc', borderRadius: 10, fontSize: 10, color: '#6c7890', lineHeight: 1.8 }}>
          <div style={{ fontWeight: 700, color: '#4169e1', marginBottom: 4, letterSpacing: .5 }}>DEMO CREDENTIALS</div>
          <div><b>Admin:</b> admin@dispatchgrid.com / admin123</div>
          <div><b>Customer:</b> customer@example.com / customer123</div>
          <div><b>Technician:</b> tech01@dispatchgrid.com / tech123</div>
        </div>
      </div>
    </div>
  );
}

function Field({ icon, placeholder, value, onChange, type = 'text' }: {
  icon: React.ReactNode; placeholder: string; value: string;
  onChange: (v: string) => void; type?: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1.5px solid #e3e8f0', borderRadius: 9, padding: '11px 13px', marginBottom: 12, background: '#fafbfd' }}>
      <span style={{ color: '#8090a8' }}>{icon}</span>
      <input type={type} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)}
        style={{ border: 0, outline: 0, background: 'transparent', fontSize: 13, flex: 1, color: '#1a2944' }} required={type !== 'tel'} />
    </div>
  );
}
