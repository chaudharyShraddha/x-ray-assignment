/**
 * X-Ray SDK - Main API
 * Provides a clean interface for instrumenting multi-step processes
 */

import { v4 as uuidv4 } from 'uuid';
import { XRayClient } from './client';
import {
  Run,
  Step,
  Candidate,
  Filter,
  RunOptions,
  StepOptions,
  CandidateOptions,
  FilterOptions
} from '@xray/shared';

export interface XRayConfig {
  apiUrl: string;
  timeout?: number;
  retryOnFailure?: boolean;
  // Performance thresholds
  fullCaptureThreshold?: number; // Capture all candidates if count < this
  summaryThreshold?: number;     // Use summary if count > this
  topAcceptedCount?: number;      // Number of top accepted to capture
  sampleRejectedCount?: number;   // Number of rejected to sample
}

export class XRay {
  private client: XRayClient;
  private config: XRayConfig;
  private currentRun: Run | null = null;
  private stepIndex: number = 0;
  private pendingSteps: Map<string, Step> = new Map();

  constructor(config: XRayConfig) {
    this.config = {
      fullCaptureThreshold: 100,
      summaryThreshold: 1000,
      topAcceptedCount: 50,
      sampleRejectedCount: 20,
      ...config
    };
    this.client = new XRayClient({
      apiUrl: config.apiUrl,
      timeout: config.timeout,
      retryOnFailure: config.retryOnFailure
    });
  }

  /**
   * Start a new run (pipeline execution)
   */
  async startRun(options: RunOptions): Promise<Run> {
    const run: Run = {
      id: uuidv4(),
      pipelineId: options.pipelineId,
      pipelineVersion: options.pipelineVersion,
      status: 'running',
      startedAt: new Date(),
      metadata: options.metadata || {},
      input: options.input
    };

    // Don't send id, startedAt, status - API generates these
    const { id, startedAt, status, ...runData } = run;
    
    // Create run in API and get the actual ID
    const createdRun = await this.client.createRun(runData);
    
    // Use the ID from the API response and convert date strings to Date objects
    run.id = createdRun.id;
    run.startedAt = new Date(createdRun.startedAt);
    run.status = createdRun.status;

    this.currentRun = run;
    this.stepIndex = 0;
    this.pendingSteps.clear();

    return run;
  }

  /**
   * Complete a run
   */
  async completeRun(output?: any, error?: string): Promise<void> {
    if (!this.currentRun) {
      throw new Error('No active run. Call startRun() first.');
    }

    this.currentRun.status = error ? 'failed' : 'completed';
    this.currentRun.completedAt = new Date();
    this.currentRun.output = output;
    this.currentRun.error = error;

    for (const step of this.pendingSteps.values()) {
      if (step.status === 'running') {
        await this.completeStep(step.id, undefined, 'Run completed');
      }
    }

    await this.client.updateRun(this.currentRun.id, {
      status: this.currentRun.status,
      completedAt: this.currentRun.completedAt,
      output: this.currentRun.output,
      error: this.currentRun.error
    });

    this.currentRun = null;
    this.stepIndex = 0;
    this.pendingSteps.clear();
  }

  /**
   * Start a new step
   */
  async startStep(options: StepOptions): Promise<Step> {
    if (!this.currentRun) {
      throw new Error('No active run. Call startRun() first.');
    }

    const step: Step = {
      id: uuidv4(),
      runId: this.currentRun.id,
      stepType: options.stepType,
      stepIndex: this.stepIndex++,
      status: 'running',
      startedAt: new Date(),
      input: options.input,
      reasoning: options.reasoning,
      config: options.config,
      metadata: options.metadata || {},
      captureAllCandidates: options.captureAllCandidates
    };

    // Don't send id, startedAt, status - API generates these
    const { id, startedAt, status, ...stepData } = step;
    
    // Create step in API and get the actual ID
    const createdStep = await this.client.createStep(stepData);
    
    // Use the ID from the API response and convert date strings to Date objects
    step.id = createdStep.id;
    step.startedAt = new Date(createdStep.startedAt);
    step.status = createdStep.status;

    // Store step with correct ID from API
    this.pendingSteps.set(step.id, step);
    return step;
  }

  /**
   * Complete a step
   */
  async completeStep(
    stepId: string,
    output?: any,
    error?: string,
    reasoning?: string
  ): Promise<void> {
    const step = this.pendingSteps.get(stepId);
    if (!step) {
      throw new Error(`Step ${stepId} not found`);
    }

    const completedAt = new Date();
    const durationMs = completedAt.getTime() - step.startedAt.getTime();

    step.status = error ? 'failed' : 'completed';
    step.completedAt = completedAt;
    step.output = output;
    step.error = error;
    step.durationMs = durationMs;
    if (reasoning) {
      step.reasoning = reasoning;
    }

    // Only send defined fields to avoid validation errors
    const updates: any = {
      status: step.status,
      completedAt: step.completedAt,
      durationMs: step.durationMs
    };
    
    if (step.output !== undefined) updates.output = step.output;
    if (step.error !== undefined) updates.error = step.error;
    if (step.reasoning !== undefined) updates.reasoning = step.reasoning;

    // Update step in API
    await this.client.updateStep(stepId, updates);

    this.pendingSteps.delete(stepId);
  }

  /**
   * Record candidates for a step
   * Handles performance optimization automatically
   */
  async recordCandidates(
    stepId: string,
    candidates: CandidateOptions[],
    acceptedIds: string[] = []
  ): Promise<void> {
    const step = this.pendingSteps.get(stepId);
    if (!step) {
      throw new Error(`Step ${stepId} not found`);
    }

    const totalCount = candidates.length;
    const acceptedCount = acceptedIds.length;
    const rejectedCount = totalCount - acceptedCount;

    step.inputCount = totalCount;
    step.outputCount = acceptedCount;

    const captureAll = step.captureAllCandidates ??
      (totalCount < (this.config.fullCaptureThreshold || 100));

    const candidatesToRecord: Candidate[] = [];

    if (captureAll) {
      for (const candidate of candidates) {
        const status = acceptedIds.includes(candidate.candidateId)
          ? 'accepted'
          : 'rejected';

        candidatesToRecord.push({
          id: uuidv4(),
          stepId,
          candidateId: candidate.candidateId,
          status,
          score: candidate.score,
          reason: status === 'rejected' ? 'Filtered out' : undefined,
          data: candidate.data,
          metadata: candidate.metadata || {}
        });
      }
    } else {
      const accepted: CandidateOptions[] = [];
      const rejected: CandidateOptions[] = [];

      for (const candidate of candidates) {
        if (acceptedIds.includes(candidate.candidateId)) {
          accepted.push(candidate);
        } else {
          rejected.push(candidate);
        }
      }

      accepted.sort((a, b) => (b.score || 0) - (a.score || 0));

      const topAccepted = accepted.slice(0, this.config.topAcceptedCount || 50);
      for (const candidate of topAccepted) {
        candidatesToRecord.push({
          id: uuidv4(),
          stepId,
          candidateId: candidate.candidateId,
          status: 'accepted',
          score: candidate.score,
          data: candidate.data,
          metadata: candidate.metadata || {}
        });
      }

      const sampleSize = Math.min(
        this.config.sampleRejectedCount || 20,
        rejected.length
      );
      const sampled = this.shuffle(rejected).slice(0, sampleSize);
      for (const candidate of sampled) {
        candidatesToRecord.push({
          id: uuidv4(),
          stepId,
          candidateId: candidate.candidateId,
          status: 'rejected',
          reason: 'Filtered out',
          data: candidate.data,
          metadata: candidate.metadata || {}
        });
      }
    }

    if (candidatesToRecord.length > 0) {
      await this.client.createCandidates(stepId, candidatesToRecord.map(c => ({
        candidateId: c.candidateId,
        status: c.status,
        score: c.score,
        reason: c.reason,
        data: c.data,
        metadata: c.metadata
      })));
    }
  }

  /**
   * Record a filter applied at a step
   */
  async recordFilter(stepId: string, options: FilterOptions): Promise<void> {
    const filter: Filter = {
      id: uuidv4(),
      stepId,
      filterType: options.filterType,
      config: options.config,
      candidatesAffected: options.candidatesAffected,
      candidatesRejected: options.candidatesRejected,
      metadata: options.metadata || {}
    };

    await this.client.createFilter(stepId, {
      filterType: filter.filterType,
      config: filter.config,
      candidatesAffected: filter.candidatesAffected,
      candidatesRejected: filter.candidatesRejected,
      metadata: filter.metadata
    });
  }

  /**
   * Get current run
   */
  getCurrentRun(): Run | null {
    return this.currentRun;
  }

  /**
   * Utility: Shuffle array (Fisher-Yates)
   */
  private shuffle<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}

