import { Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Deploy from './pages/Deploy';
import Projects from './pages/Projects';
import Settings from './pages/Settings';

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-bold text-gray-900">Harbr</h1>
          <div className="flex gap-4 text-sm">
            <a href="/" className="text-gray-600 hover:text-gray-900">Dashboard</a>
            <a href="/projects" className="text-gray-600 hover:text-gray-900">Projects</a>
            <a href="/deploy" className="text-gray-600 hover:text-gray-900">Deploy</a>
            <a href="/settings" className="text-gray-600 hover:text-gray-900">Settings</a>
          </div>
        </div>
      </nav>
      <main className="p-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/deploy" element={<Deploy />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
