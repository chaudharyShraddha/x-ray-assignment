/**
 * X-Ray API Client
 * Handles communication with the X-Ray API backend
 */

import axios, { AxiosInstance } from 'axios';
import { Run, Step, Candidate, Filter } from '@xray/shared';

export interface XRayClientConfig {
  apiUrl: string;
  timeout?: number;
  retryOnFailure?: boolean;
}

export class XRayClient {
  private client: AxiosInstance;
  private config: XRayClientConfig;

  constructor(config: XRayClientConfig) {
    this.config = {
      timeout: 5000,
      retryOnFailure: false,
      ...config
    };

    this.client = axios.create({
      baseURL: config.apiUrl.endsWith('/') ? config.apiUrl.slice(0, -1) : config.apiUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  async createRun(run: Omit<Run, 'id' | 'startedAt' | 'status'>): Promise<Run> {
    const response = await this.client.post<Run>('/api/runs', run);
    return response.data;
  }

  async updateRun(runId: string, updates: Partial<Run>): Promise<Run> {
    const response = await this.client.patch<Run>(`/api/runs/${runId}`, updates);
    return response.data;
  }

  async createStep(step: Omit<Step, 'id' | 'startedAt' | 'status'>): Promise<Step> {
    const response = await this.client.post<Step>('/api/steps', step);
    return response.data;
  }

  async updateStep(stepId: string, updates: Partial<Step>): Promise<Step> {
    const response = await this.client.patch<Step>(`/api/steps/${stepId}`, updates);
    return response.data;
  }

  async createCandidates(stepId: string, candidates: Omit<Candidate, 'id' | 'stepId'>[]): Promise<Candidate[]> {
    const response = await this.client.post<Candidate[]>(`/api/steps/${stepId}/candidates`, { candidates });
    return response.data;
  }

  async createFilter(stepId: string, filter: Omit<Filter, 'id' | 'stepId'>): Promise<Filter> {
    const response = await this.client.post<Filter>(`/api/steps/${stepId}/filters`, filter);
    return response.data;
  }
}

