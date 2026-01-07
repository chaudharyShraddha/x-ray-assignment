/**
 * Base Repository
 * 
 * Provides common CRUD operations following the Repository pattern.
 * Implements DRY principle to avoid code duplication across repositories.
 * 
 * @template TEntity - TypeORM entity type
 * @template TDomain - Domain model type (from @xray/shared)
 */

import { Repository, FindOptionsWhere, ObjectLiteral } from 'typeorm';

export abstract class BaseRepository<TEntity extends ObjectLiteral, TDomain> {
  protected repository: Repository<TEntity>;

  constructor(repository: Repository<TEntity>) {
    this.repository = repository;
  }

  /**
   * Creates and saves a new entity
   * @param data - Domain model data to create
   * @returns Created domain model
   */
  async create(data: TDomain): Promise<TDomain> {
    const entity = this.repository.create(data as any);
    const saved = await this.repository.save(entity) as unknown as TEntity;
    return this.mapToDomain(saved);
  }

  /**
   * Updates an existing entity
   * @param id - Entity identifier
   * @param updates - Partial domain model with updates
   * @returns Updated domain model
   * @throws Error if entity not found
   */
  async update(id: string, updates: Partial<TDomain>): Promise<TDomain> {
    await this.repository.update(id, updates as any);
    const updated = await this.findById(id);
    if (!updated) {
      throw new Error(`${this.getEntityName()} with id ${id} not found`);
    }
    return updated;
  }

  /**
   * Finds an entity by its identifier
   * @param id - Entity identifier
   * @returns Domain model or null if not found
   */
  async findById(id: string): Promise<TDomain | null> {
    const entity = await this.repository.findOne({ where: { id } as unknown as FindOptionsWhere<TEntity> });
    return entity ? this.mapToDomain(entity) : null;
  }

  /**
   * Maps entity to domain model
   * Must be implemented by subclasses
   */
  protected abstract mapToDomain(entity: TEntity): TDomain;

  /**
   * Gets entity name for error messages
   */
  protected abstract getEntityName(): string;
}

