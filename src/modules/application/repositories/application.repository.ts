import { ApplicationRecord, IApplicationRepository } from '../IApplication';

/**
 * SQL Repository Implementation (PostgreSQL / SQLite).
 */
export class ApplicationRepository implements IApplicationRepository {
  public async findByApplicationId(_applicationId: string): Promise<ApplicationRecord | null> {
    throw new Error('ApplicationRepository.findByApplicationId is not implemented yet.');
  }

  public async createApp(
    _appData: Omit<ApplicationRecord, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ApplicationRecord> {
    throw new Error('ApplicationRepository.createApp is not implemented yet.');
  }

  public async listApps(): Promise<ApplicationRecord[]> {
    throw new Error('ApplicationRepository.listApps is not implemented yet.');
  }

  public getScopedRoomKey(applicationId: string, roomId: string): string {
    return `${applicationId}:${roomId}`;
  }
}
