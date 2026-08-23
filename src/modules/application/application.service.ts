import crypto from 'crypto';
import { cryptoService } from '../../shared/crypto/crypto.service';
import { ApplicationFeatures, ApplicationRecord } from './IApplication';
import { applicationRepository } from './application.repository';
import { NotFoundError } from '../../shared/errors';

export interface CreateAppInput {
  name: string;
  enabled?: boolean;
  features?: ApplicationFeatures;
}

export interface CreatedAppResult {
  record: ApplicationRecord;
  apiKey: string;
}

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

  public async getApp(applicationId: string): Promise<ApplicationRecord> {
    const app = await applicationRepository.findByApplicationId(applicationId);
    if (!app) {
      throw new NotFoundError(`Application '${applicationId}' not found`);
    }
    return app;
  }

  /**
   * Registers a new tenant application. Auto-generates a clean app_... identifier and apiKey.
   */
  public async registerApp(input: CreateAppInput): Promise<CreatedAppResult> {
    const applicationId = `app_${crypto.randomBytes(6).toString('hex')}`;
    const rawApiKey = cryptoService.generateApiKey();
    const apiKeyHash = cryptoService.hash(rawApiKey);

    const record = await applicationRepository.createApp({
      applicationId,
      name: input.name,
      apiKeyHash,
      enabled: input.enabled ?? true,
      features: input.features || { presence: true, rooms: true, events: true },
    });

    return { record, apiKey: rawApiKey };
  }

  public async listApps(): Promise<ApplicationRecord[]> {
    return applicationRepository.listApps();
  }

  public async updateApp(
    applicationId: string,
    updates: { name?: string; enabled?: boolean; features?: ApplicationFeatures }
  ): Promise<ApplicationRecord> {
    await this.getApp(applicationId);

    const updated = await applicationRepository.updateApp(applicationId, updates);
    if (!updated) {
      throw new NotFoundError(`Application '${applicationId}' not found`);
    }

    return updated;
  }

  public async rotateApiKey(applicationId: string): Promise<{ applicationId: string; newApiKey: string }> {
    await this.getApp(applicationId);

    const newApiKey = cryptoService.generateApiKey();
    const newApiKeyHash = cryptoService.hash(newApiKey);

    await applicationRepository.rotateApiKey(applicationId, newApiKeyHash);

    return { applicationId, newApiKey };
  }

  public async deleteApp(applicationId: string): Promise<boolean> {
    await this.getApp(applicationId);
    return applicationRepository.deleteApp(applicationId);
  }

  public getScopedRoomKey(applicationId: string, roomId: string): string {
    return applicationRepository.getScopedRoomKey(applicationId, roomId);
  }

  /**
   * Dynamic health check verifying repository accessibility.
   */
  public async isHealthy(): Promise<boolean> {
    try {
      await applicationRepository.listApps();
      return true;
    } catch {
      return false;
    }
  }
}

export const applicationService = new ApplicationService();
