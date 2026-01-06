/**
 * Shared Type Definitions for X-Ray System
 * Used by both SDK and API services
 */

export interface Run {
  id: string;
  pipelineId: string;
  pipelineVersion?: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  metadata: Record<string, any>;
  input: any;
  output?: any;
  error?: string;
}

export interface Step {
  id: string;
  runId: string;
  stepType: string;
  stepIndex: number;
  status: 'running' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  input: any;
  output?: any;
  reasoning?: string;
  config?: Record<string, any>;
  inputCount?: number;
  outputCount?: number;
  durationMs?: number;
  error?: string;
  metadata: Record<string, any>;
  captureAllCandidates?: boolean;
}

export interface Candidate {
  id: string;
  stepId: string;
  candidateId: string;
  status: 'accepted' | 'rejected' | 'pending';
  score?: number;
  reason?: string;
  data: Record<string, any>;
  metadata: Record<string, any>;
}

export interface Filter {
  id: string;
  stepId: string;
  filterType: string;
  config: Record<string, any>;
  candidatesAffected: number;
  candidatesRejected: number;
  metadata: Record<string, any>;
}

/**
 * Common step types (helpers, not enforced)
 */
export const CommonStepTypes = {
  KEYWORD_GENERATION: 'keyword-generation',
  SEARCH: 'search',
  FILTERING: 'filtering',
  RANKING: 'ranking',
  SELECTION: 'selection',
  LLM_EVALUATION: 'llm-evaluation',
  TRANSFORMATION: 'transformation',
  CATEGORIZATION: 'categorization'
} as const;

export interface RunOptions {
  pipelineId: string;
  pipelineVersion?: string;
  input: any;
  metadata?: Record<string, any>;
}

export interface StepOptions {
  stepType: string;
  input?: any;
  config?: Record<string, any>;
  reasoning?: string;
  captureAllCandidates?: boolean;
  metadata?: Record<string, any>;
}

export interface CandidateOptions {
  candidateId: string;
  data: Record<string, any>;
  score?: number;
  metadata?: Record<string, any>;
}

export interface FilterOptions {
  filterType: string;
  config: Record<string, any>;
  candidatesAffected: number;
  candidatesRejected: number;
  metadata?: Record<string, any>;
}

