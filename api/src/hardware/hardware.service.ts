import { Injectable, Inject, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import axios from 'axios';

export interface HardwareSnapshot {
  node_id: string;
  node_name: string;
  cpu_pct: number;
  mem_pct: number;
  disk_pct: number;
  temp_c: number | null;
  devices: Array<{ type: string; name: string; details?: Record<string, string> }>;
  fetched_at: string;
  error?: string;
}

@Injectable()
export class HardwareService {
  private readonly logger = new Logger(HardwareService.name);

  constructor(@Inject('PG_POOL') private pool: Pool) {}

  /**
   * Fetch live hardware snapshots from every online node's daemon at :7700/hardware.
   * Falls back gracefully if a node's daemon is unreachable.
   * Result is keyed by node_id so the UI can map it to node cards.
   */
  async getLiveSnapshots(): Promise<Record<string, HardwareSnapshot>> {
    const { rows: nodes } = await this.pool.query(
      "SELECT id, name, tailscale_ip FROM nodes WHERE status = 'online' AND tailscale_ip IS NOT NULL",
    );

    const results = await Promise.allSettled(
      nodes.map(async (node: { id: string; name: string; tailscale_ip: string }) => {
        try {
          const { data } = await axios.get(
            `http://${node.tailscale_ip}:7700/hardware`,
            { timeout: 4000 },
          );
          return {
            node_id: node.id,
            node_name: node.name,
            cpu_pct: data.cpu_pct ?? 0,
            mem_pct: data.mem_pct ?? 0,
            disk_pct: data.disk_pct ?? 0,
            temp_c: data.temp_c ?? null,
            devices: data.devices ?? [],
            fetched_at: new Date().toISOString(),
          } as HardwareSnapshot;
        } catch (err: any) {
          this.logger.warn(
            `Hardware daemon unreachable on node ${node.name} (${node.tailscale_ip}): ${err.message}`,
          );
          return {
            node_id: node.id,
            node_name: node.name,
            cpu_pct: 0, mem_pct: 0, disk_pct: 0,
            temp_c: null, devices: [],
            fetched_at: new Date().toISOString(),
            error: 'daemon_unreachable',
          } as HardwareSnapshot;
        }
      }),
    );

    const map: Record<string, HardwareSnapshot> = {};
    for (const result of results) {
      if (result.status === 'fulfilled') {
        map[result.value.node_id] = result.value;
      }
    }
    return map;
  }

  /** Historical hardware events from Postgres (device add/remove audit trail) */
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

  async logEvent(data: {
    node_id: string;
    event_type: string;
    device_type?: string;
    device_info?: any;
  }) {
    const { rows } = await this.pool.query(
      `INSERT INTO hardware_events (node_id, event_type, device_type, device_info)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [data.node_id, data.event_type, data.device_type, JSON.stringify(data.device_info ?? {})],
    );
    return rows[0];
  }
}
