import { IApplicationRepository } from './IApplication';
import { InMemoryApplicationRepository } from './repositories/in-memory-application.repository';
import { DrizzleApplicationRepository } from './repositories/drizzle-application.repository';
import { db } from '../../db';

const isDbAvailable = !!db;

if (isDbAvailable) {
  console.log('[ApplicationRepository] Initialized with PostgreSQL Drizzle ORM Repository.');
} else {
  console.log('[ApplicationRepository] Initialized with In-Memory Application Repository.');
}

export const applicationRepository: IApplicationRepository = isDbAvailable
  ? new DrizzleApplicationRepository()
  : new InMemoryApplicationRepository();
