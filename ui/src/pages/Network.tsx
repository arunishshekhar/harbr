import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { useState } from 'react';


interface ExternalProxy {
  id: string;
  name: string;
  project_id: string;
  project_name?: string;
  target_address: string;
  target_port: number;
  path_prefix: string;
  enabled: boolean;
}

interface PolicyStatus {
  namespace: string;
  project_name: string;
  policy_name: string;
  default_deny: boolean;
}

export default function Network() {
  const qc = useQueryClient();
  const [newProxy, setNewProxy] = useState({
    name: '', project_id: '', target_address: '', target_port: 80, path_prefix: '/proxy',
  });
  const [proxyError, setProxyError] = useState('');
  const [showNewProxy, setShowNewProxy] = useState(false);

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get('/projects').then((r: any) => r.data),
  });

  const { data: proxies = [], isLoading: proxiesLoading } = useQuery({
    queryKey: ['network', 'proxies'],
    queryFn: () => api.get('/network/proxies').then((r: any) => r.data).catch(() => []),
  });

  const { data: policies = [], isLoading: policiesLoading } = useQuery({
    queryKey: ['network', 'policies'],
    queryFn: () => api.get('/network/policies').then((r: any) => r.data).catch(() => []),
    refetchInterval: 30_000,
  });

  const createProxy = useMutation({
    mutationFn: (body: typeof newProxy) => api.post('/network/proxies', body).then((r: any) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['network'] });
      setShowNewProxy(false);
      setNewProxy({ name: '', project_id: '', target_address: '', target_port: 80, path_prefix: '/proxy' });
      setProxyError('');
    },
    onError: (e: any) => setProxyError(e?.response?.data?.message || String(e)),
  });

  const deleteProxy = useMutation({
    mutationFn: (id: string) => api.delete('/network/proxies/' + id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['network'] }),
  });

  const toggleProxy = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      api.patch('/network/proxies/' + id, { enabled }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['network'] }),
  });

  return (
    <div style={{ maxWidth: '1000px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--color-text-primary)', marginBottom: '6px' }}>
          Network &amp; Isolation
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--color-text-dim)' }}>
          Cilium network policies per project namespace, cross-project proxies, and external routing rules.
        </p>
      </div>

      {/* Network Policies */}
      <section style={{ marginBottom: '36px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-text-primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Project Isolation Policies
          </h2>
          <span style={{ fontSize: '11px', color: 'var(--color-text-dim)', background: 'var(--color-bg-secondary)', padding: '2px 10px', borderRadius: '999px', border: '1px solid var(--color-border)' }}>
            Cilium NetworkPolicy
          </span>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="data-table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th>Namespace</th>
                <th>Project</th>
                <th>Policy</th>
                <th>Status</th>
                <th>Default Deny</th>
              </tr>
            </thead>
            <tbody>
              {policiesLoading && (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--color-text-dim)', padding: '24px' }}>Loading policies…</td></tr>
              )}
              {!policiesLoading && policies.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--color-text-dim)', padding: '24px', fontSize: '13px' }}>
                    No network policies found. Policies are automatically applied when a project is deployed.
                  </td>
                </tr>
              )}
              {policies.map((p: PolicyStatus) => (
                <tr key={p.namespace}>
                  <td><code style={{ fontSize: '12px', color: 'var(--color-blue)' }}>{p.namespace}</code></td>
                  <td style={{ color: 'var(--color-text-primary)', fontWeight: '500' }}>{p.project_name}</td>
                  <td><code style={{ fontSize: '12px' }}>{p.policy_name}</code></td>
                  <td>
                    <span className="badge badge-green" style={{ fontSize: '10px' }}>active</span>
                  </td>
                  <td>
                    <span style={{ color: p.default_deny ? 'var(--color-green)' : 'var(--color-yellow)', fontSize: '12px' }}>
                      {p.default_deny ? '✓ deny-all' : '✗ allow-all'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card" style={{ marginTop: '12px', padding: '14px 18px', background: 'rgba(0, 212, 255, 0.04)', border: '1px solid rgba(0, 212, 255, 0.15)' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: '1.7' }}>
            <strong style={{ color: 'var(--color-blue)' }}>Policy rules applied per project namespace:</strong>
            <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
              <li>Ingress: only allowed from <code>harbr-system</code> namespace (via Caddy/Traefik)</li>
              <li>Egress: allowed to internet, blocked from K3s pod network (10.42.0.0/16), service network (10.43.0.0/16), and Tailscale range (100.64.0.0/10)</li>
              <li>Cross-project communication requires explicit proxy rules below</li>
            </ul>
          </div>
        </div>
      </section>

      {/* External Proxies */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-text-primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            External Proxy Rules
          </h2>
          <button
            id="btn-new-proxy"
            onClick={() => setShowNewProxy(v => !v)}
            style={{
              background: 'var(--color-blue)', color: '#fff', border: 'none',
              borderRadius: '8px', padding: '7px 14px', fontSize: '12px',
              fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            <span>+</span> New Proxy Rule
          </button>
        </div>

        {showNewProxy && (
          <div className="card" style={{ marginBottom: '16px', padding: '18px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: '600', marginBottom: '16px', color: 'var(--color-text-primary)' }}>
              New External Proxy
            </h3>
            {proxyError && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: '#f87171', marginBottom: '14px' }}>
                {proxyError}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '5px' }}>Rule Name</label>
                <input
                  className="form-input"
                  placeholder="my-service-proxy"
                  value={newProxy.name}
                  onChange={e => setNewProxy(p => ({ ...p, name: e.target.value }))}
                  id="proxy-name-input"
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '5px' }}>Project</label>
                <select
                  className="form-input"
                  value={newProxy.project_id}
                  onChange={e => setNewProxy(p => ({ ...p, project_id: e.target.value }))}
                  id="proxy-project-select"
                >
                  <option value="">Select project…</option>
                  {projects.map((pr: any) => (
                    <option key={pr.id} value={pr.id}>{pr.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '5px' }}>Target Address</label>
                <input
                  className="form-input"
                  placeholder="service.internal or 10.0.0.5"
                  value={newProxy.target_address}
                  onChange={e => setNewProxy(p => ({ ...p, target_address: e.target.value }))}
                  id="proxy-target-input"
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '5px' }}>Port</label>
                  <input
                    className="form-input"
                    type="number"
                    min={1}
                    max={65535}
                    value={newProxy.target_port}
                    onChange={e => setNewProxy(p => ({ ...p, target_port: Number(e.target.value) }))}
                    id="proxy-port-input"
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '5px' }}>Path Prefix</label>
                  <input
                    className="form-input"
                    placeholder="/proxy"
                    value={newProxy.path_prefix}
                    onChange={e => setNewProxy(p => ({ ...p, path_prefix: e.target.value }))}
                    id="proxy-path-input"
                  />
                </div>
              </div>
            </div>
            <div style={{ marginTop: '14px', display: 'flex', gap: '10px' }}>
              <button
                id="btn-create-proxy"
                onClick={() => createProxy.mutate(newProxy)}
                disabled={createProxy.isPending || !newProxy.name || !newProxy.target_address}
                style={{
                  background: 'var(--color-blue)', color: '#fff', border: 'none',
                  borderRadius: '8px', padding: '8px 18px', fontSize: '12px',
                  fontWeight: '600', cursor: 'pointer', opacity: createProxy.isPending ? 0.6 : 1,
                }}
              >
                {createProxy.isPending ? 'Creating…' : 'Create Proxy'}
              </button>
              <button
                onClick={() => { setShowNewProxy(false); setProxyError(''); }}
                style={{
                  background: 'transparent', color: 'var(--color-text-dim)',
                  border: '1px solid var(--color-border)', borderRadius: '8px',
                  padding: '8px 16px', fontSize: '12px', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="data-table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Project</th>
                <th>Target</th>
                <th>Path Prefix</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {proxiesLoading && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--color-text-dim)', padding: '24px' }}>Loading…</td></tr>
              )}
              {!proxiesLoading && proxies.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--color-text-dim)', padding: '32px', fontSize: '13px' }}>
                    <div style={{ marginBottom: '6px' }}>No proxy rules configured</div>
                    <div style={{ fontSize: '11px' }}>External proxy rules let you securely access services outside the K8s cluster from a project's domain path.</div>
                  </td>
                </tr>
              )}
              {proxies.map((px: ExternalProxy) => (
                <tr key={px.id}>
                  <td style={{ fontWeight: '600', color: 'var(--color-text-primary)' }}>{px.name}</td>
                  <td style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{px.project_name || px.project_id}</td>
                  <td>
                    <code style={{ fontSize: '12px', color: 'var(--color-blue)' }}>
                      {px.target_address}:{px.target_port}
                    </code>
                  </td>
                  <td><code style={{ fontSize: '12px' }}>{px.path_prefix}</code></td>
                  <td>
                    <button
                      onClick={() => toggleProxy.mutate({ id: px.id, enabled: !px.enabled })}
                      style={{
                        background: px.enabled ? 'rgba(16,185,129,0.1)' : 'rgba(107,114,128,0.1)',
                        color: px.enabled ? 'var(--color-green)' : 'var(--color-text-dim)',
                        border: px.enabled ? '1px solid rgba(16,185,129,0.3)' : '1px solid var(--color-border)',
                        borderRadius: '999px', padding: '2px 10px', fontSize: '11px',
                        fontWeight: '600', cursor: 'pointer',
                      }}
                    >
                      {px.enabled ? 'enabled' : 'disabled'}
                    </button>
                  </td>
                  <td>
                    <button
                      onClick={() => { if (window.confirm(`Delete proxy rule "${px.name}"?`)) deleteProxy.mutate(px.id); }}
                      style={{
                        background: 'transparent', color: 'var(--color-red)',
                        border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px',
                        padding: '4px 10px', fontSize: '11px', cursor: 'pointer',
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card" style={{ marginTop: '12px', padding: '14px 18px', background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.15)' }}>
          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: '1.7', margin: 0 }}>
            <strong style={{ color: 'var(--color-yellow)' }}>Security note:</strong>{' '}
            Proxy targets are validated against a blocklist — internal K8s CIDRs, Tailscale IPs, and sensitive ports are always blocked.
            Targets are resolved and checked against the <code>ExternalProxyService</code> CIDR blocklist before the rule is saved.
          </p>
        </div>
      </section>
    </div>
  );
}
