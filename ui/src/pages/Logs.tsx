import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';

export default function Logs() {
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [mode, setMode] = useState<'live' | 'build'>('live');
  const [lines, setLines] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get('/projects').then(r => r.data),
  });

  // SSE live logs
  useEffect(() => {
    if (!selectedProject || mode !== 'live') return;
    setLines([]);
    const es = new EventSource(`/api/v1/logs/${selectedProject}/stream`);
    es.onmessage = e => {
      setLines(prev => [...prev.slice(-500), e.data]);
    };
    es.onerror = () => es.close();
    return () => es.close();
  }, [selectedProject, mode]);

  // Build log fetch
  const { data: buildLog } = useQuery({
    queryKey: ['buildlog', selectedProject],
    queryFn: () => api.get(`/logs/${selectedProject}/build`).then(r => r.data?.log ?? ''),
    enabled: !!selectedProject && mode === 'build',
  });

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  const displayLines = mode === 'build'
    ? (buildLog ?? '').split('\n')
    : lines;

  function getLineClass(line: string): string {
    const l = line.toLowerCase();
    if (l.includes('error') || l.includes('fatal') || l.includes('err ')) return 'error';
    if (l.includes('warn') || l.includes('warning')) return 'warn';
    if (l.startsWith('[info]') || l.startsWith('info:')) return 'info';
    return '';
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', height: 'calc(100vh - 120px)' }}>
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--color-text-primary)', marginBottom: '4px', letterSpacing: '-0.02em' }}>Logs</h1>
        <p style={{ fontSize: '14px', color: 'var(--color-text-dim)' }}>Live container logs and build output</p>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <select className="harbr-select" style={{ width: '220px' }} value={selectedProject} onChange={e => setSelectedProject(e.target.value)}>
          <option value="">Select project…</option>
          {(projects as any[]).map((p: any) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <div style={{ display: 'flex', gap: '2px', background: 'var(--color-bg-secondary)', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
          {(['live', 'build'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              padding: '5px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer',
              fontWeight: '500', fontSize: '13px',
              background: mode === m ? 'var(--color-bg-card)' : 'transparent',
              color: mode === m ? 'var(--color-text-primary)' : 'var(--color-text-dim)',
              transition: 'all 0.15s',
            }}>
              {m === 'live' ? '● Live' : '⬛ Build'}
            </button>
          ))}
        </div>
        {mode === 'live' && selectedProject && (
          <span className="badge badge-green" style={{ animation: 'pulse-green 2s infinite' }}>● Streaming</span>
        )}
        <button className="btn-secondary" style={{ marginLeft: 'auto' }} onClick={() => setLines([])}>Clear</button>
      </div>

      {/* Log output */}
      <div className="glass-card" style={{
        flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column',
        padding: '0',
      }}>
        {!selectedProject ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-dim)', fontSize: '14px' }}>
            Select a project to view logs
          </div>
        ) : (
          <div style={{
            flex: 1, overflowY: 'auto', padding: '16px 20px',
            background: 'var(--color-bg-primary)',
            borderRadius: 'var(--radius-lg)',
          }}>
            {displayLines.length === 0 ? (
              <div style={{ color: 'var(--color-text-dim)', fontSize: '13px', fontFamily: 'var(--font-mono)' }}>
                {mode === 'live' ? 'Waiting for log output…' : 'No build logs found'}
              </div>
            ) : (
              displayLines.map((line: string, i: number) => (
                <div key={i} className={`log-line ${getLineClass(line)}`}>
                  <span style={{ color: 'var(--color-text-dim)', userSelect: 'none', marginRight: '12px', minWidth: '32px', display: 'inline-block', textAlign: 'right' }}>
                    {i + 1}
                  </span>
                  {line}
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}
