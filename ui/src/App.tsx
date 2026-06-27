import { Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import Deploy from './pages/Deploy';
import Nodes from './pages/Nodes';
import Logs from './pages/Logs';
import Storage from './pages/Storage';
import Network from './pages/Network';
import Domains from './pages/Domains';
import Webhooks from './pages/Webhooks';
import Alerts from './pages/Alerts';
import AuditLog from './pages/AuditLog';
import Users from './pages/Users';
import Settings from './pages/Settings';


const NAV = [
  { to: '/',         label: 'Dashboard',  icon: '⬡',  exact: true },
  { to: '/projects', label: 'Projects',   icon: '⬛' },
  { to: '/deploy',   label: 'Deploy',     icon: '⬆' },
  { to: '/nodes',    label: 'Nodes',      icon: '◎' },
  { to: '/logs',     label: 'Logs',       icon: '≡' },
  { to: '/storage',  label: 'Storage',    icon: '◰' },
  { to: '/network',  label: 'Network',    icon: '⬡' },
  { to: '/domains',  label: 'Domains',    icon: '⊕' },
  { to: '/webhooks', label: 'Webhooks',   icon: '⟲' },
  { to: '/alerts',   label: 'Alerts',     icon: '⚑' },
  { to: '/audit',    label: 'Audit Log',  icon: '◷' },
  { to: '/users',    label: 'Users',      icon: '◉' },
  { to: '/settings', label: 'Settings',   icon: '⚙' },
];


export default function App() {
  const location = useLocation();

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <aside style={{
        width: '220px',
        flexShrink: 0,
        background: 'var(--color-bg-secondary)',
        borderRight: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Logo */}
        <div style={{
          padding: '22px 20px 18px',
          borderBottom: '1px solid var(--color-border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px', height: '32px',
              background: 'linear-gradient(135deg, #0ea5e9, #00d4ff)',
              borderRadius: '8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '16px', fontWeight: '800', color: '#080c14',
              flexShrink: 0,
            }}>H</div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}>
                HARBR
              </div>
              <div style={{ fontSize: '10px', color: 'var(--color-text-dim)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Infra Platform
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {NAV.map(({ to, label, icon, exact }) => {
            const isActive = exact
              ? location.pathname === to
              : location.pathname.startsWith(to);
            return (
              <NavLink
                key={to}
                to={to}
                className={`sidebar-link ${isActive ? 'active' : ''}`}
              >
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', width: '20px', textAlign: 'center' }}>{icon}</span>
                {label}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer */}
        <div style={{
          padding: '14px 20px',
          borderTop: '1px solid var(--color-border)',
          fontSize: '11px',
          color: 'var(--color-text-dim)',
        }}>
          <div style={{ marginBottom: '2px' }}>v0.1.0-dev</div>
          <div style={{ color: 'var(--color-green)', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span className="status-dot online" />
            Cluster online
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main style={{
        flex: 1,
        overflow: 'auto',
        background: 'var(--color-bg-primary)',
        padding: '28px 32px',
      }}>
        <Routes>
          <Route path="/"          element={<Dashboard />} />
          <Route path="/projects"  element={<Projects />} />
          <Route path="/deploy"    element={<Deploy />} />
          <Route path="/nodes"     element={<Nodes />} />
          <Route path="/logs"      element={<Logs />} />
          <Route path="/storage"   element={<Storage />} />
          <Route path="/network"   element={<Network />} />
          <Route path="/domains"   element={<Domains />} />
          <Route path="/webhooks"  element={<Webhooks />} />
          <Route path="/alerts"    element={<Alerts />} />
          <Route path="/audit"     element={<AuditLog />} />
          <Route path="/users"     element={<Users />} />
          <Route path="/settings"  element={<Settings />} />
          <Route path="*"          element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
