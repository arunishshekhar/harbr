import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class HardwareService {
  constructor(@Inject('PG_POOL') private pool: Pool) {}

  async getEvents(nodeId?: string) {
    if (nodeId) {
      const { rows } = await this.pool.query(
        'SELECT * FROM hardware_events WHERE node_id = $1 ORDER BY created_at DESC LIMIT 100',
        [nodeId],
      );
      return rows;
    }
    const { rows } = await this.pool.query(
      'SELECT * FROM hardware_events ORDER BY created_at DESC LIMIT 100',
    );
    return rows;
  }

  async logEvent(data: { node_id: string; event_type: string; device_type?: string; device_info?: any }) {
    const { rows } = await this.pool.query(
      `INSERT INTO hardware_events (node_id, event_type, device_type, device_info)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [data.node_id, data.event_type, data.device_type, JSON.stringify(data.device_info || {})],
    );
    return rows[0];
  }
}
