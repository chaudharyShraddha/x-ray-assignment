/**
 * Steps Repository
 * 
 * Handles data access for Step entities.
 * Extends BaseRepository to inherit common CRUD operations.
 * Implements Single Responsibility Principle - only handles Step-related data access.
 */

import { v4 as uuidv4 } from 'uuid';
import { AppDataSource } from '../db/data-source';
import { Step } from '../entities/Step.entity';
import { Step as StepDomain } from '@xray/shared';
import { BaseRepository } from './base/BaseRepository';
import { StepFilters } from './base/QueryFilters';

export class StepsRepository extends BaseRepository<Step, StepDomain> {
  constructor() {
    super(AppDataSource.getRepository(Step));
  }

  /**
   * Creates a new step with auto-generated ID and timestamps
   * @param data - Step data (id and timestamps will be auto-generated)
   * @returns Created step
   */
  async create(data: Partial<StepDomain>): Promise<StepDomain> {
    const now = new Date();
    const stepData: StepDomain = {
      id: uuidv4(),
      runId: data.runId!,
      stepType: data.stepType!,
      stepIndex: data.stepIndex!,
      status: data.status || 'running',
      startedAt: now,
      metadata: data.metadata || {},
      input: data.input,
      config: data.config,
      reasoning: data.reasoning,
      captureAllCandidates: data.captureAllCandidates || false,
      ...data
    };

    const entity = this.repository.create(stepData as any);
    const saved = await this.repository.save(entity) as unknown as Step;
    return this.mapToDomain(saved);
  }

  /**
   * Finds all steps for a specific run
   * Ordered by step index to maintain execution order
   * 
   * @param runId - Run identifier
   * @returns Array of steps ordered by execution order
   */
  async findByRunId(runId: string): Promise<StepDomain[]> {
    const steps = await this.repository.find({
      where: { runId },
      order: { stepIndex: 'ASC' }
    });
    return steps.map(step => this.mapToDomain(step));
  }

  /**
   * Finds steps by their type across all runs
   * Useful for cross-pipeline queries
   * 
   * @param stepType - Type of step to find (e.g., 'filtering', 'ranking')
   * @param filters - Optional pagination filters
   * @returns Array of steps of the specified type
   */
  async findByStepType(stepType: string, filters?: StepFilters): Promise<StepDomain[]> {
    const queryBuilder = this.repository
      .createQueryBuilder('step')
      .where('step.stepType = :stepType', { stepType })
      .orderBy('step.startedAt', 'DESC');

    if (filters?.limit) {
      queryBuilder.limit(filters.limit);
    }
    if (filters?.offset) {
      queryBuilder.offset(filters.offset);
    }

    const steps = await queryBuilder.getMany();
    return steps.map(step => this.mapToDomain(step));
  }

  /**
   * Finds filtering steps that eliminated a high percentage of candidates
   * Used for debugging and analytics queries
   * 
   * @param threshold - Elimination threshold (default 0.9 = 90%)
   * @returns Array of filtering steps that eliminated more than threshold
   */
  async findFilteringStepsWithHighElimination(threshold: number = 0.9): Promise<StepDomain[]> {
    const steps = await this.repository
      .createQueryBuilder('step')
      .where('step.stepType = :stepType', { stepType: 'filtering' })
      .andWhere('step.inputCount > 0')
      .andWhere('(CAST(step.outputCount AS FLOAT) / CAST(step.inputCount AS FLOAT)) < :threshold', {
        threshold
      })
      .orderBy('step.startedAt', 'DESC')
      .getMany();

    return steps.map(step => this.mapToDomain(step));
  }

  /**
   * Maps TypeORM entity to domain model
   */
  protected mapToDomain(entity: Step): StepDomain {
    return {
      id: entity.id,
      runId: entity.runId,
      stepType: entity.stepType,
      stepIndex: entity.stepIndex,
      status: entity.status,
      startedAt: entity.startedAt,
      completedAt: entity.completedAt,
      input: entity.input,
      output: entity.output,
      reasoning: entity.reasoning,
      config: entity.config,
      inputCount: entity.inputCount,
      outputCount: entity.outputCount,
      durationMs: entity.durationMs,
      error: entity.error,
      metadata: entity.metadata,
      captureAllCandidates: entity.captureAllCandidates
    };
  }

  /**
   * Gets entity name for error messages
   */
  protected getEntityName(): string {
    return 'Step';
  }
}
