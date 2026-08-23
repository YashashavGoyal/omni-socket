import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '../../../db';
import { applications } from '../../../db/schema';
import { ApplicationRecord, IApplicationRepository } from '../IApplication';
import { InternalServerError, ERROR_MESSAGES } from '../../../shared/errors';

export class DrizzleApplicationRepository implements IApplicationRepository {
  public async findByApplicationId(applicationId: string): Promise<ApplicationRecord | null> {
    if (!db) return null;

    const results = await db
      .select()
      .from(applications)
      .where(eq(applications.applicationId, applicationId))
      .limit(1);

    if (results.length === 0) return null;

    const row = results[0];
    return {
      id: row.id,
      applicationId: row.applicationId,
      name: row.name,
      apiKeyHash: row.apiKeyHash,
      enabled: row.enabled,
      features: row.features,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  public async createApp(
    appData: Omit<ApplicationRecord, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ApplicationRecord> {
    if (!db) {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_NOT_CONNECTED);
    }

    const now = new Date();
    const id = crypto.randomUUID();

    const newRecord = {
      id,
      applicationId: appData.applicationId,
      name: appData.name,
      apiKeyHash: appData.apiKeyHash,
      enabled: appData.enabled,
      features: appData.features || { presence: true, rooms: true, events: true },
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(applications).values(newRecord);

    return newRecord;
  }

  public async listApps(): Promise<ApplicationRecord[]> {
    if (!db) return [];

    const rows = await db.select().from(applications);

    return rows.map((row) => ({
      id: row.id,
      applicationId: row.applicationId,
      name: row.name,
      apiKeyHash: row.apiKeyHash,
      enabled: row.enabled,
      features: row.features,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  public async updateApp(
    applicationId: string,
    updates: Partial<Omit<ApplicationRecord, 'id' | 'applicationId' | 'createdAt' | 'updatedAt'>>
  ): Promise<ApplicationRecord | null> {
    if (!db) {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_NOT_CONNECTED);
    }

    const existing = await this.findByApplicationId(applicationId);
    if (!existing) return null;

    const now = new Date();
    const setPayload: Record<string, any> = {
      updatedAt: now,
    };

    if (updates.name !== undefined) {
      setPayload.name = updates.name;
    }
    if (updates.enabled !== undefined) {
      setPayload.enabled = updates.enabled;
    }
    if (updates.features !== undefined) {
      setPayload.features = { ...existing.features, ...updates.features };
    }

    await db
      .update(applications)
      .set(setPayload)
      .where(eq(applications.applicationId, applicationId));

    return this.findByApplicationId(applicationId);
  }

  public async rotateApiKey(applicationId: string, newApiKeyHash: string): Promise<boolean> {
    if (!db) {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_NOT_CONNECTED);
    }

    await db
      .update(applications)
      .set({
        apiKeyHash: newApiKeyHash,
        updatedAt: new Date(),
      })
      .where(eq(applications.applicationId, applicationId));

    return true;
  }

  public async deleteApp(applicationId: string): Promise<boolean> {
    if (!db) {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_NOT_CONNECTED);
    }

    await db.delete(applications).where(eq(applications.applicationId, applicationId));
    return true;
  }

  public getScopedRoomKey(applicationId: string, roomId: string): string {
    return `${applicationId}:${roomId}`;
  }
}
