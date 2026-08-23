import crypto from 'crypto';
import { cryptoService } from '../../../shared/crypto/crypto.service';
import { ApplicationRecord, IApplicationRepository } from '../IApplication';

export class InMemoryApplicationRepository implements IApplicationRepository {
  private apps = new Map<string, ApplicationRecord>();

  constructor() {
    const now = new Date();
    this.apps.set('ourtime', {
      id: 'app_ourtime_001',
      applicationId: 'ourtime',
      name: 'ourTime Video Platform',
      apiKeyHash: cryptoService.hash('ourtime_secret_key_v1'),
      enabled: true,
      features: {
        presence: true,
        rooms: true,
        events: true,
      },
      createdAt: now,
      updatedAt: now,
    });

    this.apps.set('demo-chat', {
      id: 'app_demochat_002',
      applicationId: 'demo-chat',
      name: 'Demo Chat Application',
      apiKeyHash: cryptoService.hash('demochat_secret_key_v1'),
      enabled: true,
      features: {
        presence: true,
        rooms: true,
        events: true,
      },
      createdAt: now,
      updatedAt: now,
    });
  }

  public async findByApplicationId(applicationId: string): Promise<ApplicationRecord | null> {
    const app = this.apps.get(applicationId);
    return app || null;
  }

  public async createApp(
    appData: Omit<ApplicationRecord, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ApplicationRecord> {
    const now = new Date();
    const record: ApplicationRecord = {
      ...appData,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    this.apps.set(record.applicationId, record);
    return record;
  }

  public async listApps(): Promise<ApplicationRecord[]> {
    return Array.from(this.apps.values());
  }

  public async updateApp(
    applicationId: string,
    updates: Partial<Omit<ApplicationRecord, 'id' | 'applicationId' | 'createdAt' | 'updatedAt'>>
  ): Promise<ApplicationRecord | null> {
    const existing = this.apps.get(applicationId);
    if (!existing) return null;

    const updated: ApplicationRecord = {
      ...existing,
      ...updates,
      features: updates.features
        ? { ...existing.features, ...updates.features }
        : existing.features,
      updatedAt: new Date(),
    };

    this.apps.set(applicationId, updated);
    return updated;
  }

  public async rotateApiKey(applicationId: string, newApiKeyHash: string): Promise<boolean> {
    const existing = this.apps.get(applicationId);
    if (!existing) return false;

    existing.apiKeyHash = newApiKeyHash;
    existing.updatedAt = new Date();
    this.apps.set(applicationId, existing);
    return true;
  }

  public async deleteApp(applicationId: string): Promise<boolean> {
    return this.apps.delete(applicationId);
  }

  public getScopedRoomKey(applicationId: string, roomId: string): string {
    return `${applicationId}:${roomId}`;
  }
}
