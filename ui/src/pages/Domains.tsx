import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';

export default function Domains() {
  const { data: domains = [], isLoading } = useQuery({
    queryKey: ['domains'],
    queryFn: () => api.get('/domains').then(r => r.data),
    refetchInterval: 60_000,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--color-text-primary)', marginBottom: '4px', letterSpacing: '-0.02em' }}>Domains</h1>
        <p style={{ fontSize: '14px', color: 'var(--color-text-dim)' }}>DNS, SSL certificates, and tunnel status</p>
      </div>

      <div className="glass-card" style={{ overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-dim)' }}>Loading domains…</div>
        ) : (domains as any[]).length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '14px' }}>⊕</div>
            <div style={{ fontSize: '15px', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>No domains configured</div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-dim)' }}>Domains are added when you deploy a project with a domain set</div>
          </div>
        ) : (
          <table className="harbr-table">
            <thead>
              <tr>
                <th>Domain</th>
                <th>Mode</th>
                <th>SSL</th>
                <th>SSL Expires</th>
                <th>Current IP</th>
                <th>DDNS</th>
              </tr>
            </thead>
            <tbody>
              {(domains as any[]).map((d: any) => {
                const sslDaysLeft = d.ssl_expires_at
                  ? Math.floor((new Date(d.ssl_expires_at).getTime() - Date.now()) / 86400000)
                  : null;
                return (
                  <tr key={d.id}>
                    <td style={{ fontWeight: '500', color: 'var(--color-text-primary)' }}>
                      <a href={`https://${d.domain}`} target="_blank" rel="noopener noreferrer"
                        style={{ color: 'var(--color-accent)', textDecoration: 'none' }}>
                        {d.domain}
                      </a>
                    </td>
                    <td>
                      <span className={`badge ${d.tunnel_enabled ? 'badge-blue' : 'badge-gray'}`}>
                        {d.tunnel_enabled ? '⟲ Tunnel' : '⊕ Direct'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${d.ssl_status === 'active' ? 'badge-green' : d.ssl_status === 'pending' ? 'badge-amber' : 'badge-red'}`}>
                        {d.ssl_status ?? 'unknown'}
                      </span>
                    </td>
                    <td style={{ fontSize: '12px' }}>
                      {sslDaysLeft !== null ? (
                        <span style={{ color: sslDaysLeft < 14 ? 'var(--color-amber)' : 'var(--color-text-secondary)' }}>
                          {sslDaysLeft}d
                        </span>
                      ) : '—'}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{d.current_ip ?? '—'}</td>
                    <td>
                      <span className={`badge ${d.ddns_enabled ? 'badge-green' : 'badge-gray'}`}>
                        {d.ddns_enabled ? 'enabled' : 'off'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* SSL info */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-text-secondary)', marginBottom: '12px' }}>SSL Strategy</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', fontSize: '13px' }}>
          <div className="glass-card" style={{ padding: '14px' }}>
            <div style={{ fontWeight: '600', color: 'var(--color-accent)', marginBottom: '6px' }}>Wildcard (*.yourdomain.com)</div>
            <div style={{ color: 'var(--color-text-secondary)', lineHeight: '1.6' }}>
              DNS-01 challenge via Cloudflare API. One cert covers all subdomains. No rate limit issues.
            </div>
          </div>
          <div className="glass-card" style={{ padding: '14px' }}>
            <div style={{ fontWeight: '600', color: 'var(--color-accent)', marginBottom: '6px' }}>Specific domains</div>
            <div style={{ color: 'var(--color-text-secondary)', lineHeight: '1.6' }}>
              HTTP-01 challenge (standard). Works in both Tunnel and Direct modes.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
