import { useState } from 'react';

export default function Settings() {
  const [accessMode, setAccessMode] = useState('tunnel');

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-semibold mb-6">Settings</h2>
      <div className="bg-white rounded-lg shadow p-6 space-y-6">
        <div>
          <h3 className="font-semibold mb-3">Access Mode</h3>
          <div className="space-y-2">
            <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input type="radio" name="accessMode" value="tunnel"
                checked={accessMode === 'tunnel'}
                onChange={e => setAccessMode(e.target.value)} />
              <div>
                <div className="font-medium">Tunnel Mode (Default)</div>
                <div className="text-sm text-gray-500">Cloudflare Tunnel handles ingress. No ports exposed.</div>
              </div>
            </label>
            <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input type="radio" name="accessMode" value="direct"
                checked={accessMode === 'direct'}
                onChange={e => setAccessMode(e.target.value)} />
              <div>
                <div className="font-medium">Direct Mode</div>
                <div className="text-sm text-gray-500">DNS-01 wildcard cert via Cloudflare API. Port forwarding required.</div>
              </div>
            </label>
            <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input type="radio" name="accessMode" value="local"
                checked={accessMode === 'local'}
                onChange={e => setAccessMode(e.target.value)} />
              <div>
                <div className="font-medium">Local Only</div>
                <div className="text-sm text-gray-500">No external access. Tailscale SSH only.</div>
              </div>
            </label>
          </div>
        </div>
        <div className="pt-4 border-t">
          <h3 className="font-semibold mb-3">Cloudflare Tokens</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">DNS Token (Zone:DNS:Edit)</label>
              <input type="password" className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Enter DNS token" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tunnel Token (Account:Tunnel:Edit)</label>
              <input type="password" className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Enter Tunnel token" />
            </div>
          </div>
        </div>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
          Save Settings
        </button>
      </div>
    </div>
  );
}
