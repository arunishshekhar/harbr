import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class LogsService {
  private lokiUrl = process.env.LOKI_URL || 'http://localhost:3100';

  async query(query: string, start?: string, end?: string) {
    const params: any = { query, limit: 1000 };
    if (start) params.start = new Date(start).getTime() * 1e6;
    if (end) params.end = new Date(end).getTime() * 1e6;
    const { data } = await axios.get(`${this.lokiUrl}/loki/api/v1/query_range`, { params });
    return data;
  }

  async projectLogs(namespace: string, podName?: string, tailLines = 100) {
    const label = `{namespace="${namespace}"}`;
    const query = podName
      ? `${label} |= "${podName}"`
      : label;
    return this.query(query);
  }
}
