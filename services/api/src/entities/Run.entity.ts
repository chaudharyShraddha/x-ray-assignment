/**
 * Run Entity
 * 
 * TypeORM entity representing a pipeline execution run.
 * Maps to the 'runs' table in PostgreSQL.
 * 
 * Relationships:
 * - One-to-Many with Step entities (a run has many steps)
 * 
 * Note: Uses snake_case for database columns (PostgreSQL convention)
 * but camelCase for TypeScript properties (JavaScript convention).
 */

import { Entity, PrimaryColumn, Column, OneToMany } from 'typeorm';
import { Step } from './Step.entity';

@Entity('runs')
export class RunEntity {
  @PrimaryColumn('text')
  id!: string;

  @Column('text', { name: 'pipeline_id' })
  pipelineId!: string;

  @Column('text', { nullable: true, name: 'pipeline_version' })
  pipelineVersion?: string;

  @Column('text')
  status!: 'running' | 'completed' | 'failed';

  @Column('timestamp', { name: 'started_at' })
  startedAt!: Date;

  @Column('timestamp', { nullable: true, name: 'completed_at' })
  completedAt?: Date;

  @Column('jsonb', { default: {} })
  metadata!: Record<string, any>;

  @Column('jsonb', { nullable: true })
  input?: any;

  @Column('jsonb', { nullable: true })
  output?: any;

  @Column('text', { nullable: true })
  error?: string;

  /**
   * One-to-Many relationship with Step entities
   * Cascade delete: deleting a run deletes all its steps
   */
  @OneToMany(() => Step, step => step.run, { cascade: true })
  steps!: Step[];
}
