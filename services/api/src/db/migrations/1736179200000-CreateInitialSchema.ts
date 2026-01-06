/**
 * Initial Schema Migration
 * 
 * Creates the initial database schema for the X-Ray system:
 * - runs table (pipeline executions)
 * - steps table (decision points)
 * - candidates table (items evaluated)
 * - filters table (constraints applied)
 * 
 * Includes all foreign keys, indexes, and constraints.
 * 
 * Migration timestamp: 1736179200000 (January 6, 2025)
 */

import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateInitialSchema1736179200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create runs table
    await queryRunner.createTable(
      new Table({
        name: 'runs',
        columns: [
          {
            name: 'id',
            type: 'text',
            isPrimary: true,
          },
          {
            name: 'pipeline_id',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'pipeline_version',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'started_at',
            type: 'timestamp',
            isNullable: false,
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'completed_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            default: "'{}'",
          },
          {
            name: 'input',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'output',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'error',
            type: 'text',
            isNullable: true,
          },
        ],
      }),
      true
    );

    // Create steps table
    await queryRunner.createTable(
      new Table({
        name: 'steps',
        columns: [
          {
            name: 'id',
            type: 'text',
            isPrimary: true,
          },
          {
            name: 'run_id',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'step_type',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'step_index',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'started_at',
            type: 'timestamp',
            isNullable: false,
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'completed_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'input',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'output',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'reasoning',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'config',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'input_count',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'output_count',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'duration_ms',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            default: "'{}'",
          },
          {
            name: 'error',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'capture_all_candidates',
            type: 'boolean',
            default: false,
          },
        ],
      }),
      true
    );

    // Create candidates table
    await queryRunner.createTable(
      new Table({
        name: 'candidates',
        columns: [
          {
            name: 'id',
            type: 'text',
            isPrimary: true,
          },
          {
            name: 'step_id',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'candidate_id',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'score',
            type: 'real',
            isNullable: true,
          },
          {
            name: 'reason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'data',
            type: 'jsonb',
            isNullable: false,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            default: "'{}'",
          },
        ],
      }),
      true
    );

    // Create filters table
    await queryRunner.createTable(
      new Table({
        name: 'filters',
        columns: [
          {
            name: 'id',
            type: 'text',
            isPrimary: true,
          },
          {
            name: 'step_id',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'filter_type',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'config',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'candidates_affected',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'candidates_rejected',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            default: "'{}'",
          },
        ],
      }),
      true
    );

    // Add foreign keys
    await queryRunner.createForeignKey(
      'steps',
      new TableForeignKey({
        columnNames: ['run_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'runs',
        onDelete: 'CASCADE',
      })
    );

    await queryRunner.createForeignKey(
      'candidates',
      new TableForeignKey({
        columnNames: ['step_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'steps',
        onDelete: 'CASCADE',
      })
    );

    await queryRunner.createForeignKey(
      'filters',
      new TableForeignKey({
        columnNames: ['step_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'steps',
        onDelete: 'CASCADE',
      })
    );

    // Create indexes for query performance
    await queryRunner.createIndex(
      'steps',
      new TableIndex({
        name: 'idx_steps_run_id',
        columnNames: ['run_id'],
      })
    );

    await queryRunner.createIndex(
      'steps',
      new TableIndex({
        name: 'idx_steps_step_type',
        columnNames: ['step_type'],
      })
    );

    await queryRunner.createIndex(
      'steps',
      new TableIndex({
        name: 'idx_steps_run_type',
        columnNames: ['run_id', 'step_type'],
      })
    );

    await queryRunner.createIndex(
      'candidates',
      new TableIndex({
        name: 'idx_candidates_step_id',
        columnNames: ['step_id'],
      })
    );

    await queryRunner.createIndex(
      'candidates',
      new TableIndex({
        name: 'idx_candidates_status',
        columnNames: ['step_id', 'status'],
      })
    );

    await queryRunner.createIndex(
      'filters',
      new TableIndex({
        name: 'idx_filters_step_id',
        columnNames: ['step_id'],
      })
    );

    await queryRunner.createIndex(
      'runs',
      new TableIndex({
        name: 'idx_runs_pipeline_id',
        columnNames: ['pipeline_id'],
      })
    );

    await queryRunner.createIndex(
      'runs',
      new TableIndex({
        name: 'idx_runs_status',
        columnNames: ['status'],
      })
    );

    await queryRunner.createIndex(
      'runs',
      new TableIndex({
        name: 'idx_runs_started_at',
        columnNames: ['started_at'],
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse order (respecting foreign key constraints)
    await queryRunner.dropTable('filters', true);
    await queryRunner.dropTable('candidates', true);
    await queryRunner.dropTable('steps', true);
    await queryRunner.dropTable('runs', true);
  }
}

