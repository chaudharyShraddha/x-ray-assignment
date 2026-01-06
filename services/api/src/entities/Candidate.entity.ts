/**
 * Candidate Entity
 * 
 * TypeORM entity representing an item evaluated at a step.
 * Maps to the 'candidates' table in PostgreSQL.
 * 
 * Relationships:
 * - Many-to-One with Step entity (a candidate belongs to one step)
 * 
 * Note: Candidates are stored per-step to track transformation through the pipeline.
 */

import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Step } from './Step.entity';

@Entity('candidates')
export class Candidate {
  @PrimaryColumn('text')
  id!: string;

  @Column('text', { name: 'step_id' })
  stepId!: string;

  /**
   * Many-to-One relationship with Step entity
   * Cascade delete: deleting a step deletes all its candidates
   */
  @ManyToOne(() => Step, step => step.candidates, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'step_id' })
  step!: Step;

  @Column('text', { name: 'candidate_id' })
  candidateId!: string;

  @Column('text')
  status!: 'accepted' | 'rejected' | 'pending';

  @Column('real', { nullable: true })
  score?: number;

  @Column('text', { nullable: true })
  reason?: string;

  @Column('jsonb')
  data!: Record<string, any>;

  @Column('jsonb', { default: {} })
  metadata!: Record<string, any>;
}
