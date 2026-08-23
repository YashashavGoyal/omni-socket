import { pgTable, text, varchar, boolean, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { ApplicationFeatures } from '../modules/application/IApplication';

export const applications = pgTable('applications', {
  id: text('id').primaryKey(),
  applicationId: varchar('application_id', { length: 255 }).notNull().unique(),
  name: text('name').notNull(),
  apiKeyHash: text('api_key_hash').notNull(),
  enabled: boolean('enabled').default(true).notNull(),
  features: jsonb('features').$type<ApplicationFeatures>().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type ApplicationSelect = typeof applications.$inferSelect;
export type ApplicationInsert = typeof applications.$inferInsert;
