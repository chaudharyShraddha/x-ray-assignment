/**
 * Query Filter Interfaces
 * 
 * Defines filter interfaces for query operations.
 * Follows Interface Segregation Principle - clients only depend on what they need.
 */

/**
 * Pagination options for queries
 */
export interface PaginationOptions {
  limit?: number;
  offset?: number;
}

/**
 * Run query filters
 */
export interface RunFilters extends PaginationOptions {
  pipelineId?: string;
  status?: 'running' | 'completed' | 'failed';
}

/**
 * Step query filters
 */
export interface StepFilters extends PaginationOptions {
  status?: 'running' | 'completed' | 'failed';
}

/**
 * Candidate query filters
 */
export interface CandidateFilters extends PaginationOptions {
  status?: 'accepted' | 'rejected' | 'pending';
}

