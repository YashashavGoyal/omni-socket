CREATE TABLE IF NOT EXISTS "applications" (
	"id" text PRIMARY KEY NOT NULL,
	"application_id" varchar(255) NOT NULL,
	"name" text NOT NULL,
	"api_key_hash" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"features" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "applications_application_id_unique" UNIQUE("application_id")
);
