import { cryptoService } from '../../shared/crypto/crypto.service';
import { ApplicationRecord } from './IApplication';
import { applicationRepository } from './application.repository';

export class ApplicationService {
  /**
   * Validates client credentials during Socket.IO handshake authentication.
   */
  public async validateAppCredentials(applicationId: string, rawApiKey: string): Promise<boolean> {
    const app = await applicationRepository.findByApplicationId(applicationId);
    if (!app || !app.enabled) {
      return false;
    }

    return cryptoService.verifyHash(rawApiKey, app.apiKeyHash);
  }

  public async getApp(applicationId: string): Promise<ApplicationRecord | null> {
    return applicationRepository.findByApplicationId(applicationId);
  }

  /**
   * Registers a new application, hashing its raw API key automatically via CryptoService.
   */
  public async registerApp(
    appData: Omit<ApplicationRecord, 'id' | 'createdAt' | 'updatedAt' | 'apiKeyHash'> & { apiKey: string }
  ): Promise<ApplicationRecord> {
    const apiKeyHash = cryptoService.hash(appData.apiKey);

    return applicationRepository.createApp({
      applicationId: appData.applicationId,
      name: appData.name,
      apiKeyHash,
      enabled: appData.enabled ?? true,
    });
  }

  public async listApps(): Promise<ApplicationRecord[]> {
    return applicationRepository.listApps();
  }

  public getScopedRoomKey(applicationId: string, roomId: string): string {
    return applicationRepository.getScopedRoomKey(applicationId, roomId);
  }
}

export const applicationService = new ApplicationService();
