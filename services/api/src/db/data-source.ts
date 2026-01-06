/**
 * TypeORM Data Source Configuration
 * 
 * Centralized database configuration using TypeORM.
 * Implements Dependency Inversion Principle - repositories depend on this abstraction.
 * 
 * Configuration:
 * - Uses PostgreSQL database
 * - Loads entities from entities directory
 * - Uses migrations for schema management (not synchronize)
 * - Enables query logging in development mode
 */

import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { RunEntity } from '../entities/Run.entity';
import { Step } from '../entities/Step.entity';
import { Candidate } from '../entities/Candidate.entity';
import { Filter } from '../entities/Filter.entity';

dotenv.config();

/**
 * TypeORM DataSource instance
 * Singleton pattern - single connection pool for the application
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [RunEntity, Step, Candidate, Filter],
  synchronize: false, // Use migrations instead of auto-sync (safer for production)
  logging: process.env.NODE_ENV === 'development', // Log queries in development
  migrations: ['src/db/migrations/*.ts', 'dist/db/migrations/*.js'],
  migrationsTableName: 'migrations',
});

/**
 * Initializes database connection
 * Must be called before any database operations
 * 
 * @throws Error if connection fails
 */
export async function initializeDatabase(): Promise<void> {
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      console.log('✅ Database connection initialized');
    }
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  }
}
