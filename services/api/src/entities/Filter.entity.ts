/**
 * Filter Entity
 * 
 * TypeORM entity representing a constraint applied at a step.
 * Maps to the 'filters' table in PostgreSQL.
 * 
 * Relationships:
 * - Many-to-One with Step entity (a filter belongs to one step)
 * 
 * Note: Filters track which constraints were applied and their impact metrics.
 */

import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Step } from './Step.entity';

@Entity('filters')
export class Filter {
  @PrimaryColumn('text')
  id!: string;

  @Column('text', { name: 'step_id' })
  stepId!: string;

  /**
   * Many-to-One relationship with Step entity
   * Cascade delete: deleting a step deletes all its filters
   */
  @ManyToOne(() => Step, step => step.filters, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'step_id' })
  step!: Step;

  @Column('text', { name: 'filter_type' })
  filterType!: string;

  @Column('jsonb', { nullable: true })
  config?: Record<string, any>;

  @Column('integer', { name: 'candidates_affected' })
  candidatesAffected!: number;

  @Column('integer', { name: 'candidates_rejected' })
  candidatesRejected!: number;

  @Column('jsonb', { default: {} })
  metadata!: Record<string, any>;
}
