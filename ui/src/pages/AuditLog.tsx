import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';

const ACTION_ICONS: Record<string, string> = {
  'project.create': '⬛',
  'project.delete': '✕',
  'build.trigger': '⬆',
  'build.success': '✓',
  'build.failed': '✗',
  'deploy.start': '⬆',
  'deploy.success': '✓',
  'deploy.rollback': '⟲',
  'node.join': '◎',
  'node.remove': '✕',
  'webhook.triggered': '⟲',
  'user.login': '◉',
  'user.logout': '◉',
};

export default function AuditLog() {
  const [page, setPage] = useState(1);
  const [resource, setResource] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['audit', page, resource],
    queryFn: () => api.get(`/audit?page=${page}&limit=30${resource ? `&resource_type=${resource}` : ''}`).then(r => r.data),
    refetchInterval: 60_000,
  });

  const entries: any[] = data?.entries ?? data ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div className="section-header">
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--color-text-primary)', marginBottom: '4px', letterSpacing: '-0.02em' }}>Audit Log</h1>
          <p style={{ fontSize: '14px', color: 'var(--color-text-dim)' }}>Every admin action with actor, timestamp, and context</p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <select className="harbr-select" style={{ width: '200px' }} value={resource} onChange={e => { setResource(e.target.value); setPage(1); }}>
          <option value="">All resources</option>
          <option value="project">Projects</option>
          <option value="build">Builds</option>
          <option value="deploy">Deployments</option>
          <option value="node">Nodes</option>
          <option value="webhook">Webhooks</option>
          <option value="user">Users</option>
        </select>
      </div>

      <div className="glass-card" style={{ overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-dim)' }}>Loading audit log…</div>
        ) : entries.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '14px' }}>◷</div>
            <div style={{ fontSize: '15px', color: 'var(--color-text-secondary)' }}>No audit entries</div>
          </div>
        ) : (
          <table className="harbr-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Action</th>
                <th>Actor</th>
                <th>Resource</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e: any) => (
                <tr key={e.id}>
                  <td style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-dim)', whiteSpace: 'nowrap' }}>
                    {new Date(e.created_at).toLocaleString()}
                  </td>
                  <td>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontFamily: 'var(--font-mono)' }}>
                      <span style={{ color: 'var(--color-accent)' }}>{ACTION_ICONS[e.action] ?? '·'}</span>
                      {e.action}
                    </span>
                  </td>
                  <td style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{e.actor_name ?? 'system'}</td>
                  <td>
                    {e.resource_name && (
                      <span className="chip">{e.resource_type}/{e.resource_name}</span>
                    )}
                  </td>
                  <td style={{ fontSize: '12px', color: 'var(--color-text-dim)', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {e.changes ? JSON.stringify(e.changes).slice(0, 80) : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button className="btn-secondary" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>← Prev</button>
        <span style={{ padding: '8px 16px', color: 'var(--color-text-dim)', fontSize: '14px' }}>Page {page}</span>
        <button className="btn-secondary" onClick={() => setPage(p => p + 1)} disabled={entries.length < 30}>Next →</button>
      </div>
    </div>
  );
}
