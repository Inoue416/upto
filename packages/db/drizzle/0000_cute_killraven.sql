CREATE TYPE "public"."article_fetch_status" AS ENUM('pending', 'fetched', 'failed');--> statement-breakpoint
CREATE TYPE "public"."article_summary_status" AS ENUM('pending', 'summarized', 'failed');--> statement-breakpoint
CREATE TYPE "public"."crawl_job_status" AS ENUM('running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TABLE "article_contents" (
	"article_id" uuid PRIMARY KEY NOT NULL,
	"content_text" text,
	"content_html" text,
	"extracted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "article_metrics" (
	"article_id" uuid PRIMARY KEY NOT NULL,
	"bookmarks" integer DEFAULT 0 NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"measured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "article_summaries" (
	"article_id" uuid PRIMARY KEY NOT NULL,
	"model_id" text NOT NULL,
	"short_summary" text NOT NULL,
	"bullets" jsonb NOT NULL,
	"topics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"summarized_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"title" text NOT NULL,
	"original_url" text NOT NULL,
	"normalized_url" text NOT NULL,
	"published_at" timestamp with time zone,
	"fetch_status" "article_fetch_status" DEFAULT 'pending' NOT NULL,
	"summary_status" "article_summary_status" DEFAULT 'pending' NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crawl_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feed_endpoint_id" uuid,
	"status" "crawl_job_status" DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"fetched_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"error_summary" text
);
--> statement-breakpoint
CREATE TABLE "feed_endpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"site_url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "article_contents" ADD CONSTRAINT "article_contents_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_metrics" ADD CONSTRAINT "article_metrics_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_summaries" ADD CONSTRAINT "article_summaries_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crawl_jobs" ADD CONSTRAINT "crawl_jobs_feed_endpoint_id_feed_endpoints_id_fk" FOREIGN KEY ("feed_endpoint_id") REFERENCES "public"."feed_endpoints"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_endpoints" ADD CONSTRAINT "feed_endpoints_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "article_metrics_score_idx" ON "article_metrics" USING btree ("score");--> statement-breakpoint
CREATE UNIQUE INDEX "articles_normalized_url_unique" ON "articles" USING btree ("normalized_url");--> statement-breakpoint
CREATE INDEX "articles_published_at_idx" ON "articles" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "articles_source_id_idx" ON "articles" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "crawl_jobs_status_started_at_idx" ON "crawl_jobs" USING btree ("status","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "feed_endpoints_url_unique" ON "feed_endpoints" USING btree ("url");