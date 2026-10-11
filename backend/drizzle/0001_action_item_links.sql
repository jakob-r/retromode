ALTER TABLE "items" ADD COLUMN "linked_item_id" uuid;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "linked_group_id" uuid;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_linked_item_id_items_id_fk" FOREIGN KEY ("linked_item_id") REFERENCES "public"."items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_linked_group_id_board_groups_id_fk" FOREIGN KEY ("linked_group_id") REFERENCES "public"."board_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "items_linked_item_idx" ON "items" USING btree ("linked_item_id");--> statement-breakpoint
CREATE INDEX "items_linked_group_idx" ON "items" USING btree ("linked_group_id");