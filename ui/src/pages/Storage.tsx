import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';

export default function Storage() {
  const { data: volumes = [], isLoading } = useQuery({
    queryKey: ['storage'],
    queryFn: () => api.get('/storage/volumes').then(r => r.data),
    refetchInterval: 30_000,
  });

  const { data: nodes = [] } = useQuery({
    queryKey: ['nodes'],
    queryFn: () => api.get('/nodes').then(r => r.data),
  });

  const multiNode = (nodes as any[]).length >= 2;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--color-text-primary)', marginBottom: '4px', letterSpacing: '-0.02em' }}>Storage</h1>
        <p style={{ fontSize: '14px', color: 'var(--color-text-dim)' }}>Longhorn distributed volumes and snapshots</p>
      </div>

      {!multiNode && (
        <div className="info-strip">
          Storage replication is available when 2+ nodes are connected. Currently using local storage.
        </div>
      )}

      <div className="glass-card" style={{ overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-dim)' }}>Loading volumes…</div>
        ) : (volumes as any[]).length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '14px' }}>◰</div>
            <div style={{ fontSize: '15px', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>No volumes</div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-dim)' }}>Volumes are created automatically when projects with storage are deployed</div>
          </div>
        ) : (
          <table className="harbr-table">
            <thead>
              <tr>
                <th>Volume</th>
                <th>Size</th>
                <th>State</th>
                {multiNode && <th>Replicas</th>}
                <th>Node</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {(volumes as any[]).map((v: any, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: '500', color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)', fontSize: '13px' }}>{v.name}</td>
                  <td>{v.size}</td>
                  <td>
                    <span className={`badge ${v.state === 'attached' ? 'badge-green' : v.state === 'degraded' ? 'badge-amber' : 'badge-gray'}`}>
                      {v.state ?? 'unknown'}
                    </span>
                  </td>
                  {multiNode && <td>{v.replicas ?? 1}</td>}
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-text-dim)' }}>{v.node ?? '—'}</td>
                  <td style={{ fontSize: '12px', color: 'var(--color-text-dim)' }}>{v.created_at ? new Date(v.created_at).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Longhorn info */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-text-secondary)', marginBottom: '14px' }}>Replica Configuration</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', fontSize: '13px' }}>
          {[
            { replicas: 1, survives: 'Nothing', min: 1 },
            { replicas: 2, survives: '1 node failure', min: 2 },
            { replicas: 3, survives: '2 simultaneous failures', min: 3 },
          ].map(r => (
            <div key={r.replicas} className="glass-card" style={{ padding: '14px' }}>
              <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--color-accent)', marginBottom: '6px' }}>{r.replicas}x</div>
              <div style={{ color: 'var(--color-text-secondary)' }}>Survives: {r.survives}</div>
              <div style={{ color: 'var(--color-text-dim)', marginTop: '4px' }}>Requires {r.min}+ nodes</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
