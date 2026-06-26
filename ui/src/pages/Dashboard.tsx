import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

const api = axios.create({ baseURL: '/api/v1' });

export default function Dashboard() {
  const { data: nodes } = useQuery({
    queryKey: ['nodes'],
    queryFn: () => api.get('/nodes').then(r => r.data),
  });

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get('/projects').then(r => r.data),
  });

  const stats = {
    nodes: nodes?.length || 0,
    projects: projects?.length || 0,
    running: projects?.filter((p: any) => p.project_status === 'running').length || 0,
    building: projects?.filter((p: any) => p.project_status === 'building').length || 0,
  };

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">Dashboard</h2>
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-3xl font-bold text-blue-600">{stats.nodes}</div>
          <div className="text-sm text-gray-500 mt-1">Nodes</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-3xl font-bold text-green-600">{stats.projects}</div>
          <div className="text-sm text-gray-500 mt-1">Projects</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-3xl font-bold text-emerald-600">{stats.running}</div>
          <div className="text-sm text-gray-500 mt-1">Running</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-3xl font-bold text-amber-600">{stats.building}</div>
          <div className="text-sm text-gray-500 mt-1">Building</div>
        </div>
      </div>
      {nodes && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b font-semibold">Nodes</div>
          <table className="w-full text-sm">
            <thead className="text-left text-gray-500 border-b">
              <tr>
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Role</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">IP</th>
                <th className="px-6 py-3">Resources</th>
              </tr>
            </thead>
            <tbody>
              {nodes.map((node: any) => (
                <tr key={node.id} className="border-b hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium">{node.name}</td>
                  <td className="px-6 py-4 capitalize">{node.role}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      node.status === 'online' ? 'bg-green-100 text-green-800' :
                      node.status === 'offline' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>{node.status}</span>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs">{node.tailscale_ip}</td>
                  <td className="px-6 py-4">{node.cpu_cores} CPUs / {node.ram_mb}MB</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
