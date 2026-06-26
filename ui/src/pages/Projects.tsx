import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

const api = axios.create({ baseURL: '/api/v1' });

const STATUS_COLORS: Record<string, string> = {
  idle: 'bg-gray-100 text-gray-800',
  building: 'bg-blue-100 text-blue-800',
  deploying: 'bg-amber-100 text-amber-800',
  running: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  stopped: 'bg-gray-100 text-gray-800',
  crashloop: 'bg-red-100 text-red-800',
};

export default function Projects() {
  const { data: projects, refetch } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get('/projects').then(r => r.data),
  });

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">Projects</h2>
      <div className="bg-white rounded-lg shadow">
        <table className="w-full text-sm">
          <thead className="text-left text-gray-500 border-b">
            <tr>
              <th className="px-6 py-3">Name</th>
              <th className="px-6 py-3">Namespace</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Port</th>
              <th className="px-6 py-3">Image</th>
            </tr>
          </thead>
          <tbody>
            {projects?.map((p: any) => (
              <tr key={p.id} className="border-b hover:bg-gray-50">
                <td className="px-6 py-4 font-medium">{p.name}</td>
                <td className="px-6 py-4 font-mono text-xs">{p.namespace}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[p.project_status] || 'bg-gray-100'}`}>
                    {p.project_status}
                  </span>
                </td>
                <td className="px-6 py-4">{p.port}</td>
                <td className="px-6 py-4">{p.current_image_tag ? p.current_image_tag.slice(0, 12) : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
