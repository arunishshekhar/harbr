import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

export default function Nodes() {
  const qc = useQueryClient();
  const [showJoinToken, setShowJoinToken] = useState(false);
  const [joinToken, setJoinToken] = useState<string | null>(null);

  const { data: nodes = [], isLoading } = useQuery({
    queryKey: ['nodes'],
    queryFn: () => api.get('/nodes').then(r => r.data),
    refetchInterval: 10_000,
  });

  const genTokenMutation = useMutation({
    mutationFn: () => api.post('/nodes/join-token').then(r => r.data),
    onSuccess: (data: any) => { setJoinToken(data.token); setShowJoinToken(true); },
  });

  const deleteNodeMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/nodes/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nodes'] }),
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div className="section-header">
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--color-text-primary)', marginBottom: '4px', letterSpacing: '-0.02em' }}>Nodes</h1>
          <p style={{ fontSize: '14px', color: 'var(--color-text-dim)' }}>Cluster nodes and hardware specs</p>
        </div>
        <button className="btn-primary" onClick={() => genTokenMutation.mutate()}>
          + Add Node
        </button>
      </div>

      {/* Join token panel */}
      {showJoinToken && joinToken && (
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '12px' }}>
            Join Token Generated
          </div>
          <div className="info-strip">
            Run this on the new machine:
          </div>
          <div style={{
            marginTop: '10px', padding: '14px 16px',
            background: 'var(--color-bg-primary)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--color-accent)',
            wordBreak: 'break-all',
          }}>
            harbr join {joinToken}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-dim)', marginTop: '10px' }}>
            ⚠ This token is valid for 24 hours and can only be used once.
          </div>
          <button className="btn-secondary" style={{ marginTop: '12px' }} onClick={() => { setShowJoinToken(false); setJoinToken(null); }}>
            Close
          </button>
        </div>
      )}

      <div className="glass-card" style={{ overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-dim)' }}>Loading nodes…</div>
        ) : (nodes as any[]).length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '14px' }}>◎</div>
            <div style={{ fontSize: '15px', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>No nodes connected</div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-dim)' }}>Run <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-accent)' }}>harbr setup</span> to initialize your first node</div>
          </div>
        ) : (
          <table className="harbr-table">
            <thead>
              <tr>
                <th>Node</th>
                <th>Role</th>
                <th>Status</th>
                <th>Tailscale IP</th>
                <th>CPU</th>
                <th>RAM</th>
                <th>Disk</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(nodes as any[]).map((n: any) => (
                <tr key={n.id}>
                  <td style={{ fontWeight: '500', color: 'var(--color-text-primary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className={`status-dot ${n.status === 'online' ? 'online' : n.status === 'pending' ? 'pending' : 'offline'}`} />
                      {n.name}
                    </div>
                  </td>
                  <td><span className={`badge ${n.role === 'primary' ? 'badge-blue' : 'badge-gray'}`}>{n.role}</span></td>
                  <td><span className={`badge ${n.status === 'online' ? 'badge-green' : 'badge-red'}`}>{n.status}</span></td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{n.tailscale_ip ?? '—'}</td>
                  <td>{n.cpu_cores ? `${n.cpu_cores} cores` : '—'}</td>
                  <td>{n.ram_mb ? `${(n.ram_mb / 1024).toFixed(0)} GB` : '—'}</td>
                  <td>{n.disk_gb ? `${n.disk_gb} GB` : '—'}</td>
                  <td style={{ fontSize: '12px', color: 'var(--color-text-dim)' }}>
                    {n.joined_at ? new Date(n.joined_at).toLocaleDateString() : '—'}
                  </td>
                  <td>
                    {n.role !== 'primary' && (
                      <button
                        className="btn-secondary"
                        style={{ padding: '4px 10px', fontSize: '12px', color: 'var(--color-red)', borderColor: 'rgba(239,68,68,0.3)' }}
                        onClick={() => { if (confirm(`Remove node "${n.name}"?`)) deleteNodeMutation.mutate(n.id); }}
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* HA info */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-text-secondary)', marginBottom: '12px' }}>High Availability</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', fontSize: '13px' }}>
          {[
            { nodes: '1', datastore: 'External Postgres', ha: 'None', failover: '—' },
            { nodes: '2', datastore: 'Postgres + streaming', ha: '30–60s', failover: 'DNS swap' },
            { nodes: '3+', datastore: 'Postgres + Patroni', ha: '10–30s', failover: 'DNS swap' },
          ].map(row => (
            <div key={row.nodes} className="glass-card" style={{ padding: '14px' }}>
              <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--color-accent)', marginBottom: '6px' }}>{row.nodes}</div>
              <div style={{ color: 'var(--color-text-dim)' }}>node{row.nodes !== '1' ? 's' : ''}</div>
              <div style={{ marginTop: '10px', color: 'var(--color-text-secondary)' }}>{row.datastore}</div>
              <div style={{ color: 'var(--color-text-dim)', marginTop: '4px' }}>Failover: {row.failover}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
