import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

export default function Webhooks() {
  const qc = useQueryClient();
  const [selectedProject, setSelectedProject] = useState('');

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get('/projects').then(r => r.data),
  });

  const { data: webhook, refetch } = useQuery({
    queryKey: ['webhook', selectedProject],
    queryFn: () => api.get(`/webhooks/project/${selectedProject}`).then(r => r.data),
    enabled: !!selectedProject,
  });

  const createMutation = useMutation({
    mutationFn: (projectId: string) => api.post('/webhooks', { project_id: projectId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['webhook', selectedProject] }); refetch(); },
  });

  const webhookUrl = webhook?.endpoint_path
    ? `${window.location.origin}/api/v1/webhooks/${webhook.endpoint_path}`
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--color-text-primary)', marginBottom: '4px', letterSpacing: '-0.02em' }}>Webhooks</h1>
        <p style={{ fontSize: '14px', color: 'var(--color-text-dim)' }}>Auto-deploy on git push</p>
      </div>

      {/* Project selector */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--color-text-secondary)', marginBottom: '12px' }}>Select project to configure</div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <select className="harbr-select" style={{ flex: 1 }} value={selectedProject} onChange={e => setSelectedProject(e.target.value)}>
            <option value="">Select a project…</option>
            {(projects as any[]).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {selectedProject && !webhook && (
            <button className="btn-primary" onClick={() => createMutation.mutate(selectedProject)}>
              Create Webhook
            </button>
          )}
        </div>
      </div>

      {/* Webhook config */}
      {webhook && (
        <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--color-text-primary)' }}>Webhook Configuration</div>

          <div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-dim)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Webhook URL</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input className="harbr-input" value={webhookUrl ?? ''} readOnly style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }} />
              <button className="btn-secondary" onClick={() => navigator.clipboard.writeText(webhookUrl ?? '')}>Copy</button>
            </div>
          </div>

          <div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-dim)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Secret</div>
            <div className="info-strip">
              Secret was shown once at creation. Regenerate from the API if lost.
            </div>
          </div>

          <div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-dim)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Branch Rules</div>
            <div className="glass-card" style={{ padding: '14px' }}>
              {Object.entries(webhook.branch_rules ?? { main: { action: 'deploy' } }).map(([branch, rule]: [string, any]) => (
                <div key={branch} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0' }}>
                  <span className="chip">{branch}</span>
                  <span style={{ color: 'var(--color-text-dim)', fontSize: '13px' }}>→</span>
                  <span className={`badge ${rule.action === 'deploy' ? 'badge-green' : 'badge-blue'}`}>{rule.action}</span>
                </div>
              ))}
            </div>
          </div>

          {/* GitHub setup guide */}
          <div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-dim)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>GitHub Setup</div>
            <div style={{ padding: '16px', background: 'var(--color-bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontFamily: 'var(--font-mono)', fontSize: '12px', lineHeight: '1.8', color: 'var(--color-text-secondary)' }}>
              <div style={{ color: 'var(--color-text-dim)', marginBottom: '4px' }}>Settings → Webhooks → Add webhook</div>
              <div>Payload URL: <span style={{ color: 'var(--color-accent)' }}>{webhookUrl}</span></div>
              <div>Content type: <span style={{ color: 'var(--color-accent)' }}>application/json</span></div>
              <div>Events: <span style={{ color: 'var(--color-accent)' }}>Push events only</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
