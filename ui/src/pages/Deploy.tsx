import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

const CATEGORIES = ['all', 'web_frameworks', 'databases', 'cms', 'media_streaming', 'storage', 'git_hosting', 'ai_llm', 'analytics', 'security_auth', 'communication', 'dev_tools', 'monitoring', 'email', 'vpn_network'];

const CATEGORY_LABELS: Record<string, string> = {
  all: 'All',
  web_frameworks: 'Web Frameworks',
  databases: 'Databases',
  cms: 'CMS',
  media_streaming: 'Media & Streaming',
  storage: 'Storage',
  git_hosting: 'Git Hosting',
  ai_llm: 'AI / LLM',
  analytics: 'Analytics',
  security_auth: 'Security & Auth',
  communication: 'Communication',
  dev_tools: 'Dev Tools',
  monitoring: 'Monitoring',
  email: 'Email',
  vpn_network: 'VPN & Network',
};

const CATEGORY_ICONS: Record<string, string> = {
  all: '⬡',
  web_frameworks: '⬛',
  databases: '◰',
  cms: '☰',
  media_streaming: '▶',
  storage: '⊡',
  git_hosting: '⊕',
  ai_llm: '◈',
  analytics: '▦',
  security_auth: '⊗',
  communication: '◎',
  dev_tools: '⟲',
  monitoring: '⚑',
  email: '✉',
  vpn_network: '◷',
};

const RUNTIME_VERSIONS = [
  { label: 'Node.js 24 (Active LTS)', value: 'node:24-alpine' },
  { label: 'Node.js 22', value: 'node:22-alpine' },
  { label: 'Python 3.12', value: 'python:3.12-slim' },
  { label: 'Python 3.11', value: 'python:3.11-slim' },
  { label: 'Go 1.24', value: 'golang:1.24-alpine' },
  { label: 'Ruby 3.3', value: 'ruby:3.3-slim' },
  { label: 'PHP 8.3', value: 'php:8.3-fpm' },
];

function TemplateCard({ template, onDeploy }: { template: any; onDeploy: () => void }) {
  const t = template.parsed ?? template;
  const name = t.name ?? template.name;
  const description = t.description ?? 'No description available';
  const category = t.category ?? 'other';

  return (
    <div
      className="glass-card glass-card-hover"
      style={{ padding: '20px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '12px' }}
      onClick={onDeploy}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--color-text-primary)' }}>{name}</div>
        <span className="badge badge-gray" style={{ flexShrink: 0 }}>{CATEGORY_LABELS[category] ?? category}</span>
      </div>
      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: '1.5', margin: 0, flex: 1 }}>
        {typeof description === 'string' ? description.slice(0, 100).trim() : '—'}
        {typeof description === 'string' && description.length > 100 ? '…' : ''}
      </p>
      {t.image && (
        <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-dim)' }}>
          {t.image}
        </div>
      )}
      <button className="btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '4px' }}>
        Deploy
      </button>
    </div>
  );
}

function DeployModal({ template, nodes, onClose, onDeploy }: any) {
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [nodeSelector, setNodeSelector] = useState('auto');

  const t = template?.parsed ?? template;
  const tName = t?.name ?? template?.name ?? 'Template';

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(8,12,20,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100, backdropFilter: 'blur(4px)',
    }}>
      <div className="glass-card" style={{ width: '480px', padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--color-text-primary)' }}>Deploy {tName}</h2>
          <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={onClose}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--color-text-dim)', display: 'block', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Project Name *
            </label>
            <input className="harbr-input" value={name} onChange={e => setName(e.target.value)}
              placeholder={tName.toLowerCase().replace(/[^a-z0-9]/g, '-')} />
          </div>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--color-text-dim)', display: 'block', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Domain (optional)
            </label>
            <input className="harbr-input" value={domain} onChange={e => setDomain(e.target.value)}
              placeholder="app.yourdomain.com" />
          </div>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--color-text-dim)', display: 'block', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Node
            </label>
            <select className="harbr-select" value={nodeSelector} onChange={e => setNodeSelector(e.target.value)}>
              <option value="auto">Auto (best available)</option>
              {(nodes ?? []).map((n: any) => <option key={n.id} value={n.name}>{n.name}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
          <button className="btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            style={{ flex: 1, justifyContent: 'center' }}
            disabled={!name}
            onClick={() => onDeploy({ name: name || tName.toLowerCase().replace(/[^a-z0-9]/g, '-'), domain, nodeSelector })}
          >
            Deploy
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Deploy() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'templates' | 'custom'>('templates');
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [deploying, setDeploying] = useState<any>(null);

  // Custom deploy state
  const [name, setName] = useState('');
  const [namespace, setNamespace] = useState('');
  const [gitUrl, setGitUrl] = useState('');
  const [gitBranch, setGitBranch] = useState('main');
  const [port, setPort] = useState('3000');
  const [domain, setDomain] = useState('');
  const [runtimeVersion, setRuntimeVersion] = useState('node:24-alpine');

  const { data: templates = [] } = useQuery({
    queryKey: ['templates'],
    queryFn: () => api.get('/templates').then(r => r.data),
  });

  const { data: nodes = [] } = useQuery({
    queryKey: ['nodes'],
    queryFn: () => api.get('/nodes').then(r => r.data),
  });

  const deployCustomMutation = useMutation({
    mutationFn: (data: any) => api.post('/projects', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); },
  });

  const deployTemplateMutation = useMutation({
    mutationFn: ({ id, config }: { id: string; config: any }) =>
      api.post(`/templates/${id}/deploy`, config),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); setDeploying(null); },
  });

  const filtered = (templates as any[]).filter(t => {
    const parsed = t.parsed ?? t;
    const matchCat = category === 'all' || parsed.category === category;
    const matchSearch = !search ||
      (parsed.name ?? t.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (parsed.description ?? '').toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--color-text-primary)', marginBottom: '4px', letterSpacing: '-0.02em' }}>Deploy</h1>
        <p style={{ fontSize: '14px', color: 'var(--color-text-dim)' }}>One-click templates or custom Git / Docker image</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '2px', background: 'var(--color-bg-secondary)', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', width: 'fit-content' }}>
        {(['templates', 'custom'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '7px 18px', borderRadius: '8px', border: 'none', cursor: 'pointer',
            fontWeight: '500', fontSize: '14px',
            background: tab === t ? 'var(--color-bg-card)' : 'transparent',
            color: tab === t ? 'var(--color-text-primary)' : 'var(--color-text-dim)',
            boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,0.3)' : 'none',
            transition: 'all 0.15s',
          }}>
            {t === 'templates' ? '⬡ Templates' : '⬛ Custom'}
          </button>
        ))}
      </div>

      {tab === 'templates' && (
        <div style={{ display: 'flex', gap: '24px' }}>
          {/* Category sidebar */}
          <div style={{ width: '180px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {CATEGORIES.map(c => (
              <button key={c} onClick={() => setCategory(c)} style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '8px 12px', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer',
                textAlign: 'left', fontSize: '13px', fontWeight: category === c ? '600' : '400',
                background: category === c ? 'var(--color-accent-dim)' : 'transparent',
                color: category === c ? 'var(--color-accent)' : 'var(--color-text-dim)',
                transition: 'all 0.15s',
              }}>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{CATEGORY_ICONS[c]}</span>
                {CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>

          {/* Template grid */}
          <div style={{ flex: 1 }}>
            <div style={{ marginBottom: '16px' }}>
              <input className="harbr-input" placeholder="Search templates…" value={search}
                onChange={e => setSearch(e.target.value)} style={{ maxWidth: '360px' }} />
            </div>
            {filtered.length === 0 ? (
              <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-dim)' }}>No templates match your filter</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '14px' }}>
                {filtered.map((t: any) => (
                  <TemplateCard key={t.name} template={t} onDeploy={() => setDeploying(t)} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'custom' && (
        <div className="glass-card" style={{ padding: '28px', maxWidth: '600px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '20px' }}>Custom Deployment</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--color-text-dim)', display: 'block', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Project Name *</label>
                <input className="harbr-input" value={name} onChange={e => setName(e.target.value)} placeholder="my-app" required />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--color-text-dim)', display: 'block', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Namespace *</label>
                <input className="harbr-input" value={namespace} onChange={e => setNamespace(e.target.value)} placeholder="my-app" required />
              </div>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--color-text-dim)', display: 'block', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Git URL</label>
              <input className="harbr-input" value={gitUrl} onChange={e => setGitUrl(e.target.value)} placeholder="https://github.com/user/repo" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--color-text-dim)', display: 'block', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Branch</label>
                <input className="harbr-input" value={gitBranch} onChange={e => setGitBranch(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--color-text-dim)', display: 'block', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Port</label>
                <input className="harbr-input" type="number" value={port} onChange={e => setPort(e.target.value)} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--color-text-dim)', display: 'block', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Domain (optional)</label>
              <input className="harbr-input" value={domain} onChange={e => setDomain(e.target.value)} placeholder="app.yourdomain.com" />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--color-text-dim)', display: 'block', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Runtime</label>
              <select className="harbr-select" value={runtimeVersion} onChange={e => setRuntimeVersion(e.target.value)}>
                {RUNTIME_VERSIONS.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
              </select>
            </div>
            <button
              className="btn-primary"
              style={{ marginTop: '6px', justifyContent: 'center' }}
              disabled={!name || !namespace || deployCustomMutation.isPending}
              onClick={() => deployCustomMutation.mutate({ name, namespace, git_url: gitUrl, git_branch: gitBranch, port: parseInt(port), domain, runtime_version: runtimeVersion })}
            >
              {deployCustomMutation.isPending ? 'Deploying…' : '⬆ Deploy Project'}
            </button>
            {deployCustomMutation.isSuccess && (
              <div className="info-strip" style={{ background: 'var(--color-green-dim)', borderColor: 'rgba(16,185,129,0.3)', color: 'var(--color-green)' }}>
                ✓ Project created — build queued
              </div>
            )}
            {deployCustomMutation.isError && (
              <div className="info-strip" style={{ background: 'var(--color-red-dim)', borderColor: 'rgba(239,68,68,0.3)', color: 'var(--color-red)' }}>
                ✗ {(deployCustomMutation.error as any)?.response?.data?.message ?? 'Deployment failed'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Deploy modal */}
      {deploying && (
        <DeployModal
          template={deploying}
          nodes={nodes}
          onClose={() => setDeploying(null)}
          onDeploy={(config: any) => deployTemplateMutation.mutate({ id: deploying.name, config })}
        />
      )}
    </div>
  );
}
