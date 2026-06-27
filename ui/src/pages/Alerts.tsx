import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';

export default function Alerts() {
  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => api.get('/alerts').then(r => r.data),
    refetchInterval: 30_000,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--color-text-primary)', marginBottom: '4px', letterSpacing: '-0.02em' }}>Alerts</h1>
        <p style={{ fontSize: '14px', color: 'var(--color-text-dim)' }}>Threshold-based alerts and notification channels</p>
      </div>

      {(alerts as any[]).length === 0 && !isLoading ? (
        <div className="glass-card" style={{ padding: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '14px' }}>⚑</div>
          <div style={{ fontSize: '15px', color: 'var(--color-green)', marginBottom: '8px' }}>● No active alerts</div>
          <div style={{ fontSize: '13px', color: 'var(--color-text-dim)' }}>Everything is running within normal parameters</div>
        </div>
      ) : (
        <div className="glass-card" style={{ overflow: 'hidden' }}>
          <table className="harbr-table">
            <thead>
              <tr>
                <th>Severity</th>
                <th>Project</th>
                <th>Metric</th>
                <th>Threshold</th>
                <th>Value</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {(alerts as any[]).map((a: any) => (
                <tr key={a.id}>
                  <td>
                    <span className={`badge ${a.severity === 'critical' ? 'badge-red' : 'badge-amber'}`}>
                      {a.severity}
                    </span>
                  </td>
                  <td style={{ fontWeight: '500', color: 'var(--color-text-primary)' }}>{a.project_name ?? '—'}</td>
                  <td>{a.metric}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}>{a.threshold_pct}%</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--color-red)' }}>{a.current_value}%</td>
                  <td style={{ fontSize: '12px', color: 'var(--color-text-dim)' }}>
                    {new Date(a.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
