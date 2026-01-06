/**
 * Candidates Repository
 * 
 * Handles data access for Candidate entities.
 * Extends BaseRepository to inherit common CRUD operations.
 * Optimized for bulk operations (createMany) since candidates are often created in batches.
 */

import { v4 as uuidv4 } from 'uuid';
import { AppDataSource } from '../db/data-source';
import { Candidate } from '../entities/Candidate.entity';
import { Candidate as CandidateDomain } from '@xray/shared';
import { BaseRepository } from './base/BaseRepository';
import { CandidateFilters } from './base/QueryFilters';

export class CandidatesRepository extends BaseRepository<Candidate, CandidateDomain> {
  constructor() {
    super(AppDataSource.getRepository(Candidate));
  }

  /**
   * Creates multiple candidates in a single transaction
   * Optimized for bulk inserts (common use case: 100s-1000s of candidates)
   * 
   * @param candidates - Array of candidate domain models
   * @returns Array of created candidates
   */
  async createMany(candidates: CandidateDomain[]): Promise<CandidateDomain[]> {
    if (candidates.length === 0) {
      return [];
    }

    const candidatesWithIds = candidates.map(c => ({
      ...c,
      id: c.id || uuidv4(),
      metadata: c.metadata || {}
    }));

    const entities = this.repository.create(candidatesWithIds as any);
    const saved = await this.repository.save(entities);
    return saved.map(c => this.mapToDomain(c));
  }

  /**
   * Finds candidates for a specific step
   * Ordered by score (descending) to show best candidates first
   * 
   * @param stepId - Step identifier
   * @param filters - Optional filters for status and pagination
   * @returns Array of candidates for the step
   */
  async findByStepId(stepId: string, filters?: CandidateFilters): Promise<CandidateDomain[]> {
    const queryBuilder = this.repository
      .createQueryBuilder('candidate')
      .where('candidate.stepId = :stepId', { stepId })
      .orderBy('candidate.score', 'DESC', 'NULLS LAST');

    if (filters?.status) {
      queryBuilder.andWhere('candidate.status = :status', {
        status: filters.status
      });
    }

    if (filters?.limit) {
      queryBuilder.limit(filters.limit);
    }

    const candidates = await queryBuilder.getMany();
    return candidates.map(c => this.mapToDomain(c));
  }

  /**
   * Maps TypeORM entity to domain model
   */
  protected mapToDomain(entity: Candidate): CandidateDomain {
    return {
      id: entity.id,
      stepId: entity.stepId,
      candidateId: entity.candidateId,
      status: entity.status,
      score: entity.score,
      reason: entity.reason,
      data: entity.data,
      metadata: entity.metadata
    };
  }

  /**
   * Gets entity name for error messages
   */
  protected getEntityName(): string {
    return 'Candidate';
  }
}
