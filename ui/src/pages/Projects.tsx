import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

const STATUS_COLORS: Record<string, string> = {
  idle:      'badge-gray',
  building:  'badge-blue',
  deploying: 'badge-amber',
  running:   'badge-green',
  failed:    'badge-red',
  stopped:   'badge-gray',
  crashloop: 'badge-red',
};

export default function Projects() {
  const qc = useQueryClient();
  const [selectedProject, setSelectedProject] = useState<any>(null);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get('/projects').then(r => r.data),
    refetchInterval: 15_000,
  });

  const deployMutation = useMutation({
    mutationFn: (id: string) => api.post(`/projects/${id}/deploy`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });

  const rollbackMutation = useMutation({
    mutationFn: (id: string) => api.post(`/projects/${id}/rollback`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/projects/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); setSelectedProject(null); },
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div className="section-header">
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--color-text-primary)', marginBottom: '4px', letterSpacing: '-0.02em' }}>Projects</h1>
          <p style={{ fontSize: '14px', color: 'var(--color-text-dim)' }}>All deployed and pending projects</p>
        </div>
        <a href="/deploy" style={{ textDecoration: 'none' }}>
          <button className="btn-primary">⬆ Deploy New</button>
        </a>
      </div>

      <div className="glass-card" style={{ overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-dim)' }}>Loading projects…</div>
        ) : (projects as any[]).length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '14px' }}>⬛</div>
            <div style={{ fontSize: '15px', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>No projects yet</div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-dim)' }}>Use Deploy to get your first project running</div>
          </div>
        ) : (
          <table className="harbr-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Status</th>
                <th>Domain</th>
                <th>Port</th>
                <th>Image</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(projects as any[]).map((p: any) => (
                <tr key={p.id}>
                  <td>
                    <div style={{ fontWeight: '500', color: 'var(--color-text-primary)' }}>{p.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-dim)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>{p.namespace}</div>
                  </td>
                  <td>
                    <span className={`badge ${STATUS_COLORS[p.project_status] ?? 'badge-gray'}`}>
                      {p.project_status === 'running' && <span className="status-dot online" />}
                      {p.project_status}
                    </span>
                  </td>
                  <td>
                    {p.domain
                      ? <a href={`https://${p.domain}`} target="_blank" rel="noopener noreferrer"
                          style={{ color: 'var(--color-accent)', textDecoration: 'none', fontSize: '13px' }}>
                          {p.domain}
                        </a>
                      : <span style={{ color: 'var(--color-text-dim)' }}>—</span>}
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}>{p.port ?? '—'}</td>
                  <td>
                    {p.current_image_tag
                      ? <span className="chip">{p.current_image_tag.slice(0, 12)}</span>
                      : <span style={{ color: 'var(--color-text-dim)' }}>—</span>}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        className="btn-secondary"
                        style={{ padding: '5px 12px', fontSize: '12px' }}
                        onClick={() => deployMutation.mutate(p.id)}
                        disabled={deployMutation.isPending}
                      >
                        Deploy
                      </button>
                      <button
                        className="btn-secondary"
                        style={{ padding: '5px 12px', fontSize: '12px' }}
                        onClick={() => rollbackMutation.mutate(p.id)}
                        disabled={rollbackMutation.isPending || !p.previous_image_tag}
                      >
                        Rollback
                      </button>
                      <button
                        className="btn-secondary"
                        style={{ padding: '5px 12px', fontSize: '12px', color: 'var(--color-red)', borderColor: 'rgba(239,68,68,0.3)' }}
                        onClick={() => {
                          if (confirm(`Delete project "${p.name}"?`)) deleteMutation.mutate(p.id);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
