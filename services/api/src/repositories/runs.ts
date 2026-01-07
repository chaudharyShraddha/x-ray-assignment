/**
 * Runs Repository
 * 
 * Handles data access for Run entities.
 * Extends BaseRepository to inherit common CRUD operations (DRY principle).
 * Implements Single Responsibility Principle - only handles Run-related data access.
 */

import { v4 as uuidv4 } from 'uuid';
import { AppDataSource } from '../db/data-source';
import { RunEntity } from '../entities/Run.entity';
import { Run } from '@xray/shared';
import { BaseRepository } from './base/BaseRepository';
import { RunFilters } from './base/QueryFilters';

export class RunsRepository extends BaseRepository<RunEntity, Run> {
  constructor() {
    super(AppDataSource.getRepository(RunEntity));
  }

  /**
   * Creates a new run with auto-generated ID and timestamps
   * @param data - Run data (id and timestamps will be auto-generated)
   * @returns Created run
   */
  async create(data: Partial<Run>): Promise<Run> {
    const now = new Date();
    const runData: Run = {
      id: uuidv4(),
      pipelineId: data.pipelineId!,
      pipelineVersion: data.pipelineVersion,
      status: data.status || 'running',
      startedAt: now,
      metadata: data.metadata || {},
      input: data.input,
      ...data
    };

    const entity = this.repository.create(runData as any);
    const saved = await this.repository.save(entity) as unknown as RunEntity;
    return this.mapToDomain(saved);
  }

  /**
   * Finds all runs with optional filters
   * Uses query builder for flexible filtering and pagination
   * 
   * @param filters - Optional filters for pipeline, status, pagination
   * @returns Array of runs matching the filters
   */
  async findAll(filters?: RunFilters): Promise<Run[]> {
    const queryBuilder = this.repository.createQueryBuilder('run');

    if (filters?.pipelineId) {
      queryBuilder.andWhere('run.pipelineId = :pipelineId', {
        pipelineId: filters.pipelineId
      });
    }

    if (filters?.status) {
      queryBuilder.andWhere('run.status = :status', {
        status: filters.status
      });
    }

    queryBuilder.orderBy('run.startedAt', 'DESC');

    if (filters?.limit) {
      queryBuilder.limit(filters.limit);
    }
    if (filters?.offset) {
      queryBuilder.offset(filters.offset);
    }

    const runs = await queryBuilder.getMany();
    return runs.map(run => this.mapToDomain(run));
  }

  /**
   * Maps TypeORM entity to domain model
   * Separates persistence layer from domain layer
   */
  protected mapToDomain(entity: RunEntity): Run {
    return {
      id: entity.id,
      pipelineId: entity.pipelineId,
      pipelineVersion: entity.pipelineVersion,
      status: entity.status,
      startedAt: entity.startedAt,
      completedAt: entity.completedAt,
      metadata: entity.metadata,
      input: entity.input,
      output: entity.output,
      error: entity.error
    };
  }

  /**
   * Gets entity name for error messages
   */
  protected getEntityName(): string {
    return 'Run';
  }
}
