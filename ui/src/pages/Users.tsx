import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

const ROLES = ['admin', 'operator', 'deployer', 'viewer'];
const ROLE_DESCRIPTIONS: Record<string, string> = {
  admin:    'Full access — manage cluster, users, and all resources',
  operator: 'Deploy, rollback, manage projects and nodes',
  deployer: 'Trigger deploys only — no config changes',
  viewer:   'Read-only access',
};

export default function Users() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', email: '', password: '', role: 'viewer' });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/users', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setShowCreate(false); setNewUser({ username: '', email: '', password: '', role: 'viewer' }); },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => api.patch(`/users/${id}`, { is_active: active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div className="section-header">
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--color-text-primary)', marginBottom: '4px', letterSpacing: '-0.02em' }}>Users</h1>
          <p style={{ fontSize: '14px', color: 'var(--color-text-dim)' }}>Manage access and roles</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>+ Add User</button>
      </div>

      {/* Roles reference */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        {ROLES.map(role => (
          <div key={role} className="glass-card" style={{ padding: '14px' }}>
            <div style={{ fontWeight: '600', marginBottom: '6px', textTransform: 'capitalize', color: role === 'admin' ? 'var(--color-red)' : role === 'operator' ? 'var(--color-amber)' : role === 'deployer' ? 'var(--color-accent)' : 'var(--color-text-secondary)' }}>
              {role}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-dim)', lineHeight: '1.5' }}>{ROLE_DESCRIPTIONS[role]}</div>
          </div>
        ))}
      </div>

      <div className="glass-card" style={{ overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-dim)' }}>Loading users…</div>
        ) : (
          <table className="harbr-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last Login</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(users as any[]).map((u: any) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: '500', color: 'var(--color-text-primary)' }}>{u.username}</td>
                  <td style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{u.email ?? '—'}</td>
                  <td>
                    <span className={`badge ${u.role === 'admin' ? 'badge-red' : u.role === 'operator' ? 'badge-amber' : u.role === 'deployer' ? 'badge-blue' : 'badge-gray'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${u.is_active ? 'badge-green' : 'badge-gray'}`}>
                      {u.is_active ? 'active' : 'inactive'}
                    </span>
                  </td>
                  <td style={{ fontSize: '12px', color: 'var(--color-text-dim)' }}>
                    {u.last_login_at ? new Date(u.last_login_at).toLocaleString() : 'Never'}
                  </td>
                  <td>
                    <button
                      className="btn-secondary"
                      style={{ padding: '4px 10px', fontSize: '12px' }}
                      onClick={() => toggleMutation.mutate({ id: u.id, active: !u.is_active })}
                    >
                      {u.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(8,12,20,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }}>
          <div className="glass-card" style={{ width: '420px', padding: '32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--color-text-primary)' }}>Add User</h2>
              <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => setShowCreate(false)}>✕</button>
            </div>
            {(['username', 'email', 'password'] as const).map(field => (
              <div key={field}>
                <label style={{ fontSize: '12px', color: 'var(--color-text-dim)', display: 'block', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{field}</label>
                <input className="harbr-input" type={field === 'password' ? 'password' : 'text'} value={(newUser as any)[field]} onChange={e => setNewUser(u => ({ ...u, [field]: e.target.value }))} />
              </div>
            ))}
            <div>
              <label style={{ fontSize: '12px', color: 'var(--color-text-dim)', display: 'block', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Role</label>
              <select className="harbr-select" value={newUser.role} onChange={e => setNewUser(u => ({ ...u, role: e.target.value }))}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={!newUser.username || !newUser.password || createMutation.isPending} onClick={() => createMutation.mutate(newUser)}>
                {createMutation.isPending ? 'Creating…' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
