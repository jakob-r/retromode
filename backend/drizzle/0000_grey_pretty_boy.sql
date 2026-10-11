CREATE TYPE "public"."retro_column" AS ENUM('well', 'improve', 'actions');--> statement-breakpoint
CREATE TABLE "boards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"owner_client_id" uuid NOT NULL,
	"owner_key_hash" text NOT NULL,
	"vote_limit" integer DEFAULT 3 NOT NULL,
	"locked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "boards_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "board_groups" (
	"id" uuid PRIMARY KEY NOT NULL,
	"board_id" uuid NOT NULL,
	"column" "retro_column" NOT NULL,
	"position" text NOT NULL,
	"title" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"board_id" uuid NOT NULL,
	"column" "retro_column" NOT NULL,
	"group_id" uuid,
	"position" text NOT NULL,
	"text" text NOT NULL,
	"author_client_id" uuid NOT NULL,
	"author_nickname" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"item_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "votes_item_id_client_id_pk" PRIMARY KEY("item_id","client_id")
);
--> statement-breakpoint
ALTER TABLE "board_groups" ADD CONSTRAINT "board_groups_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_group_id_board_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."board_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "boards_last_activity_idx" ON "boards" USING btree ("last_activity_at");--> statement-breakpoint
CREATE INDEX "groups_board_idx" ON "board_groups" USING btree ("board_id");--> statement-breakpoint
CREATE INDEX "items_board_idx" ON "items" USING btree ("board_id");--> statement-breakpoint
CREATE INDEX "items_group_idx" ON "items" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "votes_client_idx" ON "votes" USING btree ("client_id");