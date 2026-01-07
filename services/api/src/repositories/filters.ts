/**
 * Filters Repository
 * 
 * Handles data access for Filter entities.
 * Extends BaseRepository to inherit common CRUD operations.
 * Filters are typically created once per step and rarely updated.
 */

import { v4 as uuidv4 } from 'uuid';
import { AppDataSource } from '../db/data-source';
import { Filter } from '../entities/Filter.entity';
import { Filter as FilterDomain } from '@xray/shared';
import { BaseRepository } from './base/BaseRepository';

export class FiltersRepository extends BaseRepository<Filter, FilterDomain> {
  constructor() {
    super(AppDataSource.getRepository(Filter));
  }

  /**
   * Creates a new filter with auto-generated ID
   * @param data - Filter data (id will be auto-generated)
   * @returns Created filter
   */
  async create(data: Partial<FilterDomain>): Promise<FilterDomain> {
    const filterData: FilterDomain = {
      id: uuidv4(),
      stepId: data.stepId!,
      filterType: data.filterType!,
      config: data.config || {},
      candidatesAffected: data.candidatesAffected!,
      candidatesRejected: data.candidatesRejected!,
      metadata: data.metadata || {},
      ...data
    };

    const entity = this.repository.create(filterData as any);
    const saved = await this.repository.save(entity) as unknown as Filter;
    return this.mapToDomain(saved);
  }

  /**
   * Finds all filters for a specific step
   * Used to understand which filters were applied and their impact
   * 
   * @param stepId - Step identifier
   * @returns Array of filters applied to the step
   */
  async findByStepId(stepId: string): Promise<FilterDomain[]> {
    const filters = await this.repository.find({
      where: { stepId }
    });
    return filters.map(f => this.mapToDomain(f));
  }

  /**
   * Maps TypeORM entity to domain model
   */
  protected mapToDomain(entity: Filter): FilterDomain {
    return {
      id: entity.id,
      stepId: entity.stepId,
      filterType: entity.filterType,
      config: entity.config || {},
      candidatesAffected: entity.candidatesAffected,
      candidatesRejected: entity.candidatesRejected,
      metadata: entity.metadata
    };
  }

  /**
   * Gets entity name for error messages
   */
  protected getEntityName(): string {
    return 'Filter';
  }
}
