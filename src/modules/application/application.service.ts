import { ApplicationRecord } from './IApplication';
import { applicationRepository } from './application.repository';

export class ApplicationService {
  /**
   * Validates client credentials during Socket.IO handshake authentication.
   */
  public async validateAppCredentials(applicationId: string, apiKey: string): Promise<boolean> {
    const app = await applicationRepository.findByApplicationId(applicationId);
    if (!app || !app.enabled) {
      return false;
    }
    // Simple V1 key hash match; replace with bcrypt/argon2 in production
    return app.apiKeyHash === apiKey;
  }

  public async getApp(applicationId: string): Promise<ApplicationRecord | null> {
    return applicationRepository.findByApplicationId(applicationId);
  }

  public async registerApp(
    appData: Omit<ApplicationRecord, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ApplicationRecord> {
    return applicationRepository.createApp(appData);
  }

  public async listApps(): Promise<ApplicationRecord[]> {
    return applicationRepository.listApps();
  }

  public getScopedRoomKey(applicationId: string, roomId: string): string {
    return applicationRepository.getScopedRoomKey(applicationId, roomId);
  }
}

export const applicationService = new ApplicationService();
