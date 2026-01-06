/**
 * Step Entity
 * 
 * TypeORM entity representing a decision point within a run.
 * Maps to the 'steps' table in PostgreSQL.
 * 
 * Relationships:
 * - Many-to-One with RunEntity (a step belongs to one run)
 * - One-to-Many with Candidate entities (a step has many candidates)
 * - One-to-Many with Filter entities (a step has many filters)
 */

import { Entity, PrimaryColumn, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { RunEntity } from './Run.entity';
import { Candidate } from './Candidate.entity';
import { Filter } from './Filter.entity';

@Entity('steps')
export class Step {
  @PrimaryColumn('text')
  id!: string;

  @Column('text', { name: 'run_id' })
  runId!: string;

  /**
   * Many-to-One relationship with RunEntity
   * Cascade delete: deleting a run deletes all its steps
   */
  @ManyToOne(() => RunEntity, run => run.steps, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'run_id' })
  run!: RunEntity;

  @Column('text', { name: 'step_type' })
  stepType!: string;

  @Column('integer', { name: 'step_index' })
  stepIndex!: number;

  @Column('text')
  status!: 'running' | 'completed' | 'failed';

  @Column('timestamp', { name: 'started_at' })
  startedAt!: Date;

  @Column('timestamp', { nullable: true, name: 'completed_at' })
  completedAt?: Date;

  @Column('jsonb', { nullable: true })
  input?: any;

  @Column('jsonb', { nullable: true })
  output?: any;

  @Column('text', { nullable: true })
  reasoning?: string;

  @Column('jsonb', { nullable: true })
  config?: Record<string, any>;

  @Column('integer', { nullable: true, name: 'input_count' })
  inputCount?: number;

  @Column('integer', { nullable: true, name: 'output_count' })
  outputCount?: number;

  @Column('integer', { nullable: true, name: 'duration_ms' })
  durationMs?: number;

  @Column('jsonb', { default: {} })
  metadata!: Record<string, any>;

  @Column('text', { nullable: true })
  error?: string;

  @Column('boolean', { default: false, name: 'capture_all_candidates' })
  captureAllCandidates!: boolean;

  /**
   * One-to-Many relationship with Candidate entities
   * Cascade delete: deleting a step deletes all its candidates
   */
  @OneToMany(() => Candidate, candidate => candidate.step, { cascade: true })
  candidates!: Candidate[];

  /**
   * One-to-Many relationship with Filter entities
   * Cascade delete: deleting a step deletes all its filters
   */
  @OneToMany(() => Filter, filter => filter.step, { cascade: true })
  filters!: Filter[];
}
