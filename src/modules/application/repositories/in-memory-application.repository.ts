import crypto from 'crypto';
import { cryptoService } from '../../../shared/crypto/crypto.service';
import { ApplicationRecord, IApplicationRepository } from '../IApplication';

export class InMemoryApplicationRepository implements IApplicationRepository {
  private appsById = new Map<string, ApplicationRecord>();
  private appsBySlug = new Map<string, ApplicationRecord>();

  constructor() {
    const now = new Date();
    const ourtimeRecord: ApplicationRecord = {
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
    };
    this.appsById.set(ourtimeRecord.id, ourtimeRecord);
    this.appsBySlug.set(ourtimeRecord.applicationId, ourtimeRecord);

    const demoChatRecord: ApplicationRecord = {
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
    };
    this.appsById.set(demoChatRecord.id, demoChatRecord);
    this.appsBySlug.set(demoChatRecord.applicationId, demoChatRecord);
  }

  public async findById(id: string): Promise<ApplicationRecord | null> {
    return this.appsById.get(id) || null;
  }

  public async findByApplicationId(applicationId: string): Promise<ApplicationRecord | null> {
    return this.appsBySlug.get(applicationId) || null;
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
    this.appsById.set(record.id, record);
    this.appsBySlug.set(record.applicationId, record);
    return record;
  }

  public async listApps(): Promise<ApplicationRecord[]> {
    return Array.from(this.appsById.values());
  }

  public async updateApp(
    id: string,
    updates: Partial<Omit<ApplicationRecord, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<ApplicationRecord | null> {
    const existing = this.appsById.get(id);
    if (!existing) return null;

    if (updates.applicationId && updates.applicationId !== existing.applicationId) {
      this.appsBySlug.delete(existing.applicationId);
    }

    const updated: ApplicationRecord = {
      ...existing,
      ...updates,
      features: updates.features
        ? { ...existing.features, ...updates.features }
        : existing.features,
      updatedAt: new Date(),
    };

    this.appsById.set(id, updated);
    this.appsBySlug.set(updated.applicationId, updated);
    return updated;
  }

  public async rotateApiKey(id: string, newApiKeyHash: string): Promise<boolean> {
    const existing = this.appsById.get(id);
    if (!existing) return false;

    existing.apiKeyHash = newApiKeyHash;
    existing.updatedAt = new Date();
    this.appsById.set(id, existing);
    this.appsBySlug.set(existing.applicationId, existing);
    return true;
  }

  public async deleteApp(id: string): Promise<boolean> {
    const existing = this.appsById.get(id);
    if (!existing) return false;

    this.appsBySlug.delete(existing.applicationId);
    return this.appsById.delete(id);
  }

  public getScopedRoomKey(applicationId: string, roomId: string): string {
    return `${applicationId}:${roomId}`;
  }
}
