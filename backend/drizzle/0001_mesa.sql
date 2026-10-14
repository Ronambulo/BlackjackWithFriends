CREATE TABLE "hands" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"modo" text NOT NULL,
	"apuesta" bigint NOT NULL,
	"ronda" jsonb NOT NULL,
	"fase" text NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"neto" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hands_apuesta" CHECK ("hands"."apuesta" > 0)
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "fichas_prueba" bigint DEFAULT 1000 NOT NULL;--> statement-breakpoint
ALTER TABLE "hands" ADD CONSTRAINT "hands_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hands_user_id_idx" ON "hands" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "hands_one_open_idx" ON "hands" USING btree ("user_id","modo") WHERE "hands"."fase" <> 'settled';--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_fichas_prueba" CHECK ("profiles"."fichas_prueba" >= 0);