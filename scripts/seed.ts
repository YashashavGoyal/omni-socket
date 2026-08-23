import { db, sqlClient } from '../src/db';
import { applications } from '../src/db/schema';
import { cryptoService } from '../src/shared/crypto/crypto.service';

export async function seedDatabase() {
  if (!sqlClient || !db) {
    console.error('❌ Cannot run seed script: Database connection is not configured.');
    process.exit(1);
  }

  console.log('🌱 Starting database initial seeding...');

  try {
    // Seed default applications if table is empty
    const existing = await db.select().from(applications).limit(1);

    if (existing.length === 0) {
      const now = new Date();
      await db.insert(applications).values([
        {
          id: 'app_ourtime_001',
          applicationId: 'ourtime',
          name: 'ourTime Video Platform',
          apiKeyHash: cryptoService.hash('ourtime_secret_key_v1'),
          enabled: true,
          features: { presence: true, rooms: true, events: true },
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'app_demochat_002',
          applicationId: 'demo-chat',
          name: 'Demo Chat Application',
          apiKeyHash: cryptoService.hash('demochat_secret_key_v1'),
          enabled: true,
          features: { presence: true, rooms: true, events: true },
          createdAt: now,
          updatedAt: now,
        },
      ]);
      console.log('✅ Default tenant applications successfully seeded into PostgreSQL.');
    } else {
      console.log('ℹ️ Applications table already populated. Skipping seed.');
    }
  } catch (err: any) {
    console.error('❌ Database seed failed:', err.message || err);
    process.exit(1);
  } finally {
    await sqlClient.end();
  }
}

seedDatabase();
