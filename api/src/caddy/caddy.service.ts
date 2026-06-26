import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class CaddyService {
  private adminApi = 'http://localhost:2019';

  async getConfig() {
    const { data } = await axios.get(`${this.adminApi}/config/`);
    return data;
  }

  async addRoute(domain: string, upstream: string) {
    const { data } = await axios.post(`${this.adminApi}/config/apps/http/servers/srv0/routes/`, {
      match: [{ host: [domain] }],
      handle: [{
        handler: 'reverse_proxy',
        upstreams: [{ dial: upstream }],
      }],
      terminal: true,
    }, {
      headers: { 'Content-Type': 'application/json' },
    });
    return data;
  }

  async removeRoute(domain: string) {
    const config = await this.getConfig();
    const routes = config?.apps?.http?.servers?.srv0?.routes || [];
    const idx = routes.findIndex((r: any) =>
      r.match?.[0]?.host?.includes(domain),
    );
    if (idx !== -1) {
      await axios.delete(`${this.adminApi}/config/apps/http/servers/srv0/routes/${idx}`);
    }
  }
}
