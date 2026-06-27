import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';

function ProgressBar({ value, type }: { value: number; type: string }) {
  const pct = Math.min(Math.max(value, 0), 100);
  const isDanger = pct > 85;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <div className="progress-bar" style={{ flex: 1 }}>
        <div
          className={`progress-fill ${isDanger ? 'danger' : type}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span style={{
        fontSize: '13px', fontWeight: '600', fontFamily: 'var(--font-mono)',
        color: isDanger ? 'var(--color-red)' : 'var(--color-text-secondary)',
        minWidth: '36px', textAlign: 'right',
      }}>
        {pct.toFixed(0)}%
      </span>
    </div>
  );
}

function NodeCard({ node, hw }: { node: any; hw?: any }) {
  const cpu = hw?.cpu_pct ?? 0;
  const mem = hw?.mem_pct ?? 0;
  const disk = hw?.disk_pct ?? 0;
  const temp = hw?.temp_c ?? null;
  const devices: any[] = hw?.devices ?? [];

  return (
    <div className="glass-card glass-card-hover animate-fade-in" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className={`status-dot ${node.status === 'online' ? 'online' : 'offline'}`} />
            <span style={{ fontSize: '16px', fontWeight: '600', color: 'var(--color-text-primary)' }}>
              {node.name}
            </span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-dim)', fontFamily: 'var(--font-mono)' }}>
            {node.tailscale_ip ?? '—'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <span className={`badge ${node.role === 'primary' ? 'badge-blue' : 'badge-gray'}`}>
            {node.role}
          </span>
          {temp !== null && (
            <span className={`badge ${temp > 80 ? 'badge-red' : temp > 65 ? 'badge-amber' : 'badge-green'}`}>
              {temp}°C
            </span>
          )}
        </div>
      </div>

      {/* Metrics */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
            <span style={{ fontSize: '12px', color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '500' }}>CPU</span>
            {node.cpu_cores && <span style={{ fontSize: '12px', color: 'var(--color-text-dim)' }}>{node.cpu_cores} cores</span>}
          </div>
          <ProgressBar value={cpu} type="cpu" />
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
            <span style={{ fontSize: '12px', color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '500' }}>RAM</span>
            {node.ram_mb && <span style={{ fontSize: '12px', color: 'var(--color-text-dim)' }}>{(node.ram_mb / 1024).toFixed(0)} GB</span>}
          </div>
          <ProgressBar value={mem} type="mem" />
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
            <span style={{ fontSize: '12px', color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '500' }}>DISK</span>
            {node.disk_gb && <span style={{ fontSize: '12px', color: 'var(--color-text-dim)' }}>{node.disk_gb} GB</span>}
          </div>
          <ProgressBar value={disk} type="disk" />
        </div>
      </div>

      {/* Connected Devices */}
      {devices.length > 0 && (
        <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '16px' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '500', marginBottom: '10px' }}>
            Connected Devices
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {devices.map((d: any, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                <span style={{ color: 'var(--color-accent)' }}>
                  {d.type?.includes('gpu') ? '⚡' : d.type?.includes('tpu') ? '◈' : '⊡'}
                </span>
                <span style={{ color: 'var(--color-text-secondary)' }}>{d.name}</span>
                {d.details?.vram_mb && (
                  <span style={{ color: 'var(--color-text-dim)', fontSize: '11px' }}>
                    · {(parseInt(d.details.vram_mb) / 1024).toFixed(0)} GB VRAM
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="glass-card animate-fade-in" style={{ padding: '20px' }}>
      <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-dim)', marginBottom: '10px' }}>
        {label}
      </div>
      <div style={{ fontSize: '32px', fontWeight: '700', color: color ?? 'var(--color-text-primary)', letterSpacing: '-0.02em', lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: '12px', color: 'var(--color-text-dim)', marginTop: '6px' }}>{sub}</div>}
    </div>
  );
}

const PROJECT_STATUS_COLORS: Record<string, string> = {
  running:   'badge-green',
  building:  'badge-blue',
  deploying: 'badge-amber',
  failed:    'badge-red',
  crashloop: 'badge-red',
  stopped:   'badge-gray',
  idle:      'badge-gray',
};

export default function Dashboard() {
  const { data: nodes = [] } = useQuery({
    queryKey: ['nodes'],
    queryFn: () => api.get('/nodes').then(r => r.data),
    refetchInterval: 10_000,
  });
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get('/projects').then(r => r.data),
    refetchInterval: 15_000,
  });
  const { data: hardwareMap = {} } = useQuery({
    queryKey: ['hardware'],
    queryFn: () => api.get('/hardware').then(r => {
      const data = r.data;
      if (Array.isArray(data)) {
        return data.reduce((acc: any, h: any) => { acc[h.node_id] = h; return acc; }, {});
      }
      return data;
    }),
    refetchInterval: 8_000,
  });

  const running  = (projects as any[]).filter(p => p.project_status === 'running').length;
  const building = (projects as any[]).filter(p => p.project_status === 'building' || p.project_status === 'deploying').length;
  const failed   = (projects as any[]).filter(p => p.project_status === 'failed' || p.project_status === 'crashloop').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--color-text-primary)', marginBottom: '6px', letterSpacing: '-0.02em' }}>
          Infrastructure
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--color-text-dim)' }}>
          Real-time hardware and cluster overview
        </p>
      </div>

      {/* Stat row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        <StatCard label="Nodes" value={(nodes as any[]).length} sub="in cluster" color="var(--color-accent)" />
        <StatCard label="Running" value={running} sub="projects live" color="var(--color-green)" />
        <StatCard label="Building" value={building} sub="in progress" color="var(--color-amber)" />
        <StatCard label="Failed" value={failed} sub="need attention" color={failed > 0 ? 'var(--color-red)' : 'var(--color-text-dim)'} />
      </div>

      {/* Node cards */}
      <div>
        <div className="section-header">
          <h2 className="section-title">Nodes</h2>
        </div>
        {(nodes as any[]).length === 0 ? (
          <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-dim)' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>◎</div>
            <div style={{ fontSize: '15px', marginBottom: '6px', color: 'var(--color-text-secondary)' }}>No nodes connected</div>
            <div style={{ fontSize: '13px' }}>Run <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-accent)' }}>harbr setup</span> on your machine to get started</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
            {(nodes as any[]).map((node: any) => (
              <NodeCard key={node.id} node={node} hw={hardwareMap[node.id]} />
            ))}
          </div>
        )}
      </div>

      {/* Recent projects */}
      {(projects as any[]).length > 0 && (
        <div>
          <div className="section-header">
            <h2 className="section-title">Recent Projects</h2>
          </div>
          <div className="glass-card" style={{ overflow: 'hidden' }}>
            <table className="harbr-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Domain</th>
                  <th>Image Tag</th>
                </tr>
              </thead>
              <tbody>
                {(projects as any[]).slice(0, 8).map((p: any) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: '500', color: 'var(--color-text-primary)' }}>{p.name}</td>
                    <td>
                      <span className={`badge ${PROJECT_STATUS_COLORS[p.project_status] ?? 'badge-gray'}`}>
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
                    <td>
                      {p.current_image_tag
                        ? <span className="chip">{p.current_image_tag.slice(0, 10)}</span>
                        : <span style={{ color: 'var(--color-text-dim)' }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
