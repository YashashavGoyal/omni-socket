import { ApplicationRecord, IApplicationRepository } from '../IApplication';

/**
 * Stub implementation for future SQL database migration (PostgreSQL / SQLite).
 * When you select your SQL provider/ORM, implement the queries here and
 * update application.repository.ts.
 */
export class SqlApplicationRepository implements IApplicationRepository {
  public async findByApplicationId(_applicationId: string): Promise<ApplicationRecord | null> {
    throw new Error('SqlApplicationRepository.findByApplicationId is not implemented yet.');
  }

  public async createApp(
    _appData: Omit<ApplicationRecord, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ApplicationRecord> {
    throw new Error('SqlApplicationRepository.createApp is not implemented yet.');
  }

  public async listApps(): Promise<ApplicationRecord[]> {
    throw new Error('SqlApplicationRepository.listApps is not implemented yet.');
  }

  public getScopedRoomKey(applicationId: string, roomId: string): string {
    return `${applicationId}:${roomId}`;
  }
}
