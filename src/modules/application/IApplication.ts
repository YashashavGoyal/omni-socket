export interface ApplicationFeatures {
  presence?: boolean;
  rooms?: boolean;
  events?: boolean;
  [key: string]: boolean | undefined;
}

export interface ApplicationRecord {
  id: string;            // Relational/Document Primary Identifier
  applicationId: string; // Unique tenant slug (e.g. 'ourtime')
  name: string;          // Human readable application name
  apiKeyHash: string;    // Hashed secret key for authentication
  enabled: boolean;      // Status flag
  features?: ApplicationFeatures; // Tenant service entitlement feature flags
  createdAt: Date;
  updatedAt: Date;
}

export interface IApplicationRepository {
  findByApplicationId(applicationId: string): Promise<ApplicationRecord | null>;
  createApp(app: Omit<ApplicationRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApplicationRecord>;
  listApps(): Promise<ApplicationRecord[]>;
  getScopedRoomKey(applicationId: string, roomId: string): string;
}
