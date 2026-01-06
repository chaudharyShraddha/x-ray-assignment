/**
 * Database Migration Script (TypeORM)
 * Runs migrations
 */

import 'reflect-metadata';
import { AppDataSource } from './data-source';

async function migrate() {
  try {
    await AppDataSource.initialize();
    console.log('✅ Database connection initialized');

    const migrations = await AppDataSource.runMigrations();
    
    if (migrations.length === 0) {
      console.log('✅ No pending migrations');
    } else {
      console.log(`✅ Ran ${migrations.length} migration(s):`);
      migrations.forEach(migration => {
        console.log(`   - ${migration.name}`);
      });
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await AppDataSource.destroy();
  }
}

migrate();
