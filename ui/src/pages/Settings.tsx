import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '../lib/api';

export default function Settings() {
  const [saved, setSaved] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ['system-settings'],
    queryFn: () => api.get('/system/settings').then(r => r.data),
  });

  const [accessMode, setAccessMode] = useState(settings?.access_mode ?? 'tunnel');
  const [cfDnsToken, setCfDnsToken] = useState('');
  const [cfTunnelToken, setCfTunnelToken] = useState('');
  const [domain, setDomain] = useState(settings?.domain ?? '');

  const saveMutation = useMutation({
    mutationFn: (data: any) => api.patch('/system/settings', data),
    onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 3000); },
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--color-text-primary)', marginBottom: '4px', letterSpacing: '-0.02em' }}>Settings</h1>
        <p style={{ fontSize: '14px', color: 'var(--color-text-dim)' }}>Cluster configuration and access mode</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '640px' }}>
        {/* Access Mode */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '4px' }}>Public Access Mode</div>
          <div style={{ fontSize: '13px', color: 'var(--color-text-dim)', marginBottom: '16px' }}>How internet traffic reaches your Harbr node</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { value: 'tunnel', label: 'Cloudflare Tunnel', desc: 'No port forwarding. Works behind CG-NAT. Default.', recommended: true },
              { value: 'direct', label: 'Direct Mode', desc: 'DNS-01 wildcard cert via Cloudflare API. Port forwarding required.', recommended: false },
              { value: 'local', label: 'Local Only', desc: 'No external access. Tailscale SSH only.', recommended: false },
            ].map(opt => (
              <label key={opt.value} style={{
                display: 'flex', alignItems: 'flex-start', gap: '12px',
                padding: '14px 16px',
                border: `1px solid ${accessMode === opt.value ? 'var(--color-accent)' : 'var(--color-border)'}`,
                borderRadius: 'var(--radius-md)',
                background: accessMode === opt.value ? 'var(--color-accent-dim)' : 'var(--color-bg-secondary)',
                cursor: 'pointer', transition: 'all 0.15s',
              }}>
                <input type="radio" name="accessMode" value={opt.value} checked={accessMode === opt.value} onChange={e => setAccessMode(e.target.value)} style={{ marginTop: '2px' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: '500', color: 'var(--color-text-primary)' }}>{opt.label}</span>
                    {opt.recommended && <span className="badge badge-green">Recommended</span>}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--color-text-dim)', marginTop: '3px' }}>{opt.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Domain */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '16px' }}>Domain</div>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--color-text-dim)', display: 'block', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Root Domain</label>
            <input className="harbr-input" value={domain} onChange={e => setDomain(e.target.value)} placeholder="yourdomain.com" />
            <div style={{ fontSize: '12px', color: 'var(--color-text-dim)', marginTop: '6px' }}>
              Projects will be accessible at subdomain.{domain || 'yourdomain.com'}
            </div>
          </div>
        </div>

        {/* Cloudflare Tokens */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '16px' }}>Cloudflare Tokens</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--color-text-dim)', display: 'block', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>DNS Token (Zone:DNS:Edit)</label>
              <input className="harbr-input" type="password" value={cfDnsToken} onChange={e => setCfDnsToken(e.target.value)} placeholder="Enter token" />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--color-text-dim)', display: 'block', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tunnel Token (Account:Tunnel:Edit)</label>
              <input className="harbr-input" type="password" value={cfTunnelToken} onChange={e => setCfTunnelToken(e.target.value)} placeholder="Enter token" />
            </div>
          </div>
        </div>

        {/* Save */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            className="btn-primary"
            onClick={() => saveMutation.mutate({ access_mode: accessMode, domain, cf_dns_token: cfDnsToken || undefined, cf_tunnel_token: cfTunnelToken || undefined })}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? 'Saving…' : 'Save Settings'}
          </button>
          {saved && <span style={{ fontSize: '13px', color: 'var(--color-green)' }}>✓ Saved</span>}
        </div>
      </div>

      {/* Ports reference */}
      <div className="glass-card" style={{ padding: '20px', maxWidth: '640px' }}>
        <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-text-secondary)', marginBottom: '14px' }}>Ports Reference</div>
        <table className="harbr-table" style={{ fontSize: '13px' }}>
          <thead>
            <tr>
              <th>Port</th>
              <th>Service</th>
              <th>Exposure</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['80', 'Caddy (ACME + HTTP redirect)', 'Public (direct mode only)'],
              ['443', 'Caddy HTTPS', 'Public (direct mode only)'],
              ['3000', 'Harbr Admin UI', 'Internal / Tailscale'],
              ['3001', 'Harbr Admin API', 'Internal / Tailscale'],
              ['7700', 'Harbr Daemon metrics', 'Internal only'],
              ['5000', 'Internal registry', 'Internal / Tailscale'],
              ['6443', 'K3s API', 'Internal / Tailscale'],
              ['5432', 'Postgres', 'Internal only'],
              ['6379', 'Redis', 'Internal only'],
            ].map(([port, service, exposure]) => (
              <tr key={port}>
                <td><span className="chip">{port}</span></td>
                <td style={{ color: 'var(--color-text-secondary)' }}>{service}</td>
                <td style={{ fontSize: '12px', color: 'var(--color-text-dim)' }}>{exposure}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
