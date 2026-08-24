import crypto from 'crypto';
import { cryptoService } from '../../shared/crypto/crypto.service';
import { ApplicationFeatures, ApplicationRecord } from './IApplication';
import { applicationRepository } from './application.repository';
import { NotFoundError, ConflictError } from '../../shared/errors';

export type SanitizedApplicationRecord = Omit<ApplicationRecord, 'apiKeyHash'>;

export interface CreateAppInput {
  name: string;
  applicationId?: string;
  enabled?: boolean;
  features?: ApplicationFeatures;
}

export interface UpdateAppInput {
  name?: string;
  applicationId?: string;
  enabled?: boolean;
  features?: ApplicationFeatures;
}

export interface CreatedAppResult {
  record: SanitizedApplicationRecord;
  apiKey: string;
}

export class ApplicationService {
  /**
   * Helper method to strip sensitive credentials (apiKeyHash) from an application record.
   */
  private sanitize(app: ApplicationRecord): SanitizedApplicationRecord {
    const { apiKeyHash, ...sanitized } = app;
    return sanitized;
  }

  /**
   * Validates client credentials during Socket.IO handshake authentication (uses applicationId slug).
   */
  public async validateAppCredentials(applicationId: string, rawApiKey: string): Promise<boolean> {
    const app = await applicationRepository.findByApplicationId(applicationId);
    if (!app || !app.enabled) {
      return false;
    }

    return cryptoService.verifyHash(rawApiKey, app.apiKeyHash);
  }

  /**
   * Retrieves an application by its primary UUID id.
   */
  public async getApp(id: string): Promise<SanitizedApplicationRecord> {
    const app = await applicationRepository.findById(id);
    if (!app) {
      throw new NotFoundError(`Application with ID '${id}' not found`);
    }
    return this.sanitize(app);
  }

  /**
   * Retrieves an application by its public applicationId slug.
   */
  public async getAppBySlug(applicationId: string): Promise<SanitizedApplicationRecord> {
    const app = await applicationRepository.findByApplicationId(applicationId);
    if (!app) {
      throw new NotFoundError(`Application with slug '${applicationId}' not found`);
    }
    return this.sanitize(app);
  }

  /**
   * Internal helper to fetch raw ApplicationRecord (including apiKeyHash).
   */
  private async getRawApp(id: string): Promise<ApplicationRecord> {
    const app = await applicationRepository.findById(id);
    if (!app) {
      throw new NotFoundError(`Application with ID '${id}' not found`);
    }
    return app;
  }

  /**
   * Registers a new tenant application.
   * - Uses user-provided applicationId slug if available (validating uniqueness).
   * - Or auto-generates a human-friendly slug / app_... identifier if omitted.
   */
  public async registerApp(input: CreateAppInput): Promise<CreatedAppResult> {
    let applicationId: string;

    if (input.applicationId) {
      const existing = await applicationRepository.findByApplicationId(input.applicationId);
      if (existing) {
        throw new ConflictError(`Application slug '${input.applicationId}' already exists`);
      }
      applicationId = input.applicationId;
    } else {
      const baseSlug =
        input.name
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '') || 'app';

      let existing = await applicationRepository.findByApplicationId(baseSlug);
      if (existing) {
        applicationId = `${baseSlug}-${crypto.randomBytes(3).toString('hex')}`;
      } else {
        applicationId = baseSlug;
      }
    }

    const rawApiKey = cryptoService.generateApiKey();
    const apiKeyHash = cryptoService.hash(rawApiKey);

    const record = await applicationRepository.createApp({
      applicationId,
      name: input.name,
      apiKeyHash,
      enabled: input.enabled ?? true,
      features: input.features || { presence: true, rooms: true, events: true },
    });

    return { record: this.sanitize(record), apiKey: rawApiKey };
  }

  public async listApps(): Promise<SanitizedApplicationRecord[]> {
    const apps = await applicationRepository.listApps();
    return apps.map((app) => this.sanitize(app));
  }

  /**
   * Updates an application by its primary UUID id. Supports changing the applicationId slug.
   */
  public async updateApp(id: string, updates: UpdateAppInput): Promise<SanitizedApplicationRecord> {
    const existing = await this.getRawApp(id);

    if (updates.applicationId && updates.applicationId !== existing.applicationId) {
      const taken = await applicationRepository.findByApplicationId(updates.applicationId);
      if (taken) {
        throw new ConflictError(`Application slug '${updates.applicationId}' is already taken`);
      }
    }

    const updated = await applicationRepository.updateApp(id, updates);
    return this.sanitize(updated!);
  }

  public async rotateApiKey(id: string): Promise<{ id: string; applicationId: string; newApiKey: string }> {
    const app = await this.getRawApp(id);

    const newApiKey = cryptoService.generateApiKey();
    const newApiKeyHash = cryptoService.hash(newApiKey);

    await applicationRepository.rotateApiKey(id, newApiKeyHash);

    return { id, applicationId: app.applicationId, newApiKey };
  }

  public async deleteApp(id: string): Promise<boolean> {
    await this.getRawApp(id);
    return applicationRepository.deleteApp(id);
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
