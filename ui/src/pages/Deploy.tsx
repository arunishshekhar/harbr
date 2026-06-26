import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';

const api = axios.create({ baseURL: '/api/v1' });

const RUNTIME_VERSIONS = [
  { label: 'Node.js 24 (LTS)', value: 'node:24-alpine' },
  { label: 'Node.js 22', value: 'node:22-alpine' },
  { label: 'Node.js 20', value: 'node:20-alpine' },
  { label: 'Python 3.12', value: 'python:3.12-slim' },
  { label: 'Python 3.11', value: 'python:3.11-slim' },
  { label: 'Go 1.24', value: 'golang:1.24-alpine' },
  { label: 'Ruby 3.3', value: 'ruby:3.3-slim' },
  { label: 'PHP 8.3', value: 'php:8.3-fpm' },
];

export default function Deploy() {
  const [name, setName] = useState('');
  const [namespace, setNamespace] = useState('');
  const [gitUrl, setGitUrl] = useState('');
  const [gitBranch, setGitBranch] = useState('main');
  const [port, setPort] = useState('3000');
  const [runtimeVersion, setRuntimeVersion] = useState('node:24-alpine');

  const deployMutation = useMutation({
    mutationFn: (data: any) => api.post('/projects', data),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    deployMutation.mutate({
      name, namespace,
      git_url: gitUrl, git_branch: gitBranch,
      port: parseInt(port), runtime_version: runtimeVersion,
    });
  };

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-semibold mb-6">Deploy New Project</h2>
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project Name</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Namespace</label>
            <input value={namespace} onChange={e => setNamespace(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm" required />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Git URL</label>
          <input value={gitUrl} onChange={e => setGitUrl(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="https://github.com/user/repo.git" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
            <input value={gitBranch} onChange={e => setGitBranch(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Port</label>
            <input type="number" value={port} onChange={e => setPort(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm" required />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Runtime Version</label>
          <select value={runtimeVersion} onChange={e => setRuntimeVersion(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm">
            {RUNTIME_VERSIONS.map(v => (
              <option key={v.value} value={v.value}>{v.label}</option>
            ))}
          </select>
        </div>
        <button type="submit" disabled={deployMutation.isPending}
          className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
          {deployMutation.isPending ? 'Deploying...' : 'Deploy Project'}
        </button>
        {deployMutation.isSuccess && (
          <div className="text-green-600 text-sm">Project deployed successfully!</div>
        )}
        {deployMutation.isError && (
          <div className="text-red-600 text-sm">Deployment failed</div>
        )}
      </form>
    </div>
  );
}
