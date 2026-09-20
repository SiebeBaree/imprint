ALTER TABLE "image_versions" DROP CONSTRAINT "image_versions_asset_id_assets_id_fk";
--> statement-breakpoint
ALTER TABLE "brands" ADD COLUMN "suggestions_status" text DEFAULT 'missing' NOT NULL;--> statement-breakpoint
ALTER TABLE "image_versions" ADD CONSTRAINT "image_versions_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;