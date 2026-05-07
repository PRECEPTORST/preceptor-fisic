CREATE TYPE "public"."ai_run_kind" AS ENUM('plan_generation', 'validation', 'summary', 'embedding', 'rerank', 'condition_tagging');--> statement-breakpoint
CREATE TYPE "public"."ai_run_status" AS ENUM('success', 'error', 'timeout', 'validation_failed');--> statement-breakpoint
CREATE TYPE "public"."experience_level" AS ENUM('iniciante', 'intermediario', 'avancado');--> statement-breakpoint
CREATE TYPE "public"."organization" AS ENUM('acsm', 'aha', 'ada', 'oms', 'esc', 'essa', 'sbc', 'sbd', 'sbmfe', 'ministerio_saude', 'outro');--> statement-breakpoint
CREATE TYPE "public"."plan_status" AS ENUM('pending', 'generating', 'generated', 'published', 'archived', 'failed');--> statement-breakpoint
CREATE TYPE "public"."cardiovascular_risk" AS ENUM('baixo', 'moderado', 'alto', 'muito_alto');--> statement-breakpoint
CREATE TYPE "public"."severity" AS ENUM('red', 'yellow', 'green');--> statement-breakpoint
CREATE TYPE "public"."sex" AS ENUM('feminino', 'masculino', 'outro', 'nao_informado');--> statement-breakpoint
CREATE TYPE "public"."source_category" AS ENUM('diretriz_oficial', 'estudo_clinico', 'revisao_sistematica', 'posicionamento', 'guia_pratico');--> statement-breakpoint
CREATE TYPE "public"."specialty" AS ENUM('prescricao_clinica', 'treinamento_funcional', 'reabilitacao', 'musculacao', 'personal', 'pilates', 'outro');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('trial', 'active', 'past_due', 'cancelled', 'inactive');--> statement-breakpoint
CREATE TABLE "ai_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"professional_id" uuid,
	"student_id" uuid,
	"plan_id" uuid,
	"kind" "ai_run_kind" NOT NULL,
	"model" text NOT NULL,
	"provider" text NOT NULL,
	"input" jsonb NOT NULL,
	"output" jsonb,
	"tokens_input" integer,
	"tokens_output" integer,
	"latency_ms" integer,
	"cost_usd" real,
	"status" "ai_run_status" NOT NULL,
	"error" text,
	"retries" integer DEFAULT 0 NOT NULL,
	"correlation_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"professional_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"payload" jsonb,
	"ip_address" text,
	"user_agent" text,
	"correlation_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clinical_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"condition_tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"rule_dsl" jsonb NOT NULL,
	"severity" "severity" DEFAULT 'yellow' NOT NULL,
	"source_refs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clinical_rules_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "condition_taxonomy" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tag" text NOT NULL,
	"label" text NOT NULL,
	"category" text NOT NULL,
	"synonyms" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"icd10" text,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "condition_taxonomy_tag_unique" UNIQUE("tag")
);
--> statement-breakpoint
CREATE TABLE "health_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"diagnoses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"surgeries" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"medications" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"injuries" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"parq_result" jsonb,
	"cardiovascular_risk" "cardiovascular_risk" DEFAULT 'baixo' NOT NULL,
	"contraindications" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"condition_tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "health_profiles_student_id_unique" UNIQUE("student_id")
);
--> statement-breakpoint
CREATE TABLE "knowledge_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"page_number" integer,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"content_hash" text NOT NULL,
	"embedding" vector(768),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tokens" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"authors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"publisher" text,
	"year" integer,
	"doi" text,
	"url" text,
	"category" "source_category" DEFAULT 'diretriz_oficial' NOT NULL,
	"organization" "organization" DEFAULT 'outro' NOT NULL,
	"population_tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"file_hash" text NOT NULL,
	"storage_path" text,
	"page_count" integer,
	"language" text DEFAULT 'pt-BR' NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_reingested_at" timestamp with time zone,
	CONSTRAINT "knowledge_sources_file_hash_unique" UNIQUE("file_hash")
);
--> statement-breakpoint
CREATE TABLE "physical_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"assessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"body_fat_pct" real,
	"lean_mass_kg" real,
	"bmi" real,
	"resting_hr" integer,
	"blood_pressure_systolic" integer,
	"blood_pressure_diastolic" integer,
	"fitness_tests" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "professionals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_user_id" uuid NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"cref" text,
	"specialty" "specialty" DEFAULT 'prescricao_clinica' NOT NULL,
	"avatar_url" text,
	"onboarding_completed" boolean DEFAULT false NOT NULL,
	"ai_preferences" jsonb DEFAULT '{"default_modality":"ambos","detail_level":"detalhado","include_assessment_protocols":true}'::jsonb NOT NULL,
	"subscription_status" "subscription_status" DEFAULT 'trial' NOT NULL,
	"subscription_plan" text,
	"subscription_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "professionals_auth_user_id_unique" UNIQUE("auth_user_id"),
	CONSTRAINT "professionals_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "progress_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"assessment_id" uuid,
	"metric_type" text NOT NULL,
	"value" real NOT NULL,
	"unit" text NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"professional_id" uuid NOT NULL,
	"draft_data" jsonb NOT NULL,
	"current_step" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"professional_id" uuid NOT NULL,
	"name" text NOT NULL,
	"birth_date" date,
	"sex" "sex" DEFAULT 'nao_informado' NOT NULL,
	"weight_kg" real,
	"height_cm" real,
	"avatar_url" text,
	"phone" text,
	"email" text,
	"consent_accepted_at" timestamp with time zone,
	"consent_terms_version" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_plan_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"revision_number" integer NOT NULL,
	"plan_data" jsonb,
	"edited_by" uuid NOT NULL,
	"change_summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"professional_id" uuid NOT NULL,
	"status" "plan_status" DEFAULT 'pending' NOT NULL,
	"plan_data" jsonb,
	"plan_summary" text,
	"restrictions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"monitoring_notes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"assessment_protocols" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"override_notes" text,
	"ai_run_id" uuid,
	"error_message" text,
	"progress_pct" integer DEFAULT 0 NOT NULL,
	"progress_phase" text,
	"generated_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"experience_level" "experience_level" DEFAULT 'iniciante' NOT NULL,
	"preferred_modalities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"weekly_sessions" integer DEFAULT 3 NOT NULL,
	"minutes_per_session" integer DEFAULT 60 NOT NULL,
	"goals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"equipment_available" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "training_preferences_student_id_unique" UNIQUE("student_id")
);
--> statement-breakpoint
CREATE TABLE "training_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid,
	"student_id" uuid NOT NULL,
	"logged_by" uuid NOT NULL,
	"session_date" timestamp with time zone DEFAULT now() NOT NULL,
	"session_label" text,
	"exercises_done" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"perceived_effort" integer,
	"observations" text,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_professional_id_professionals_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_plan_id_training_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."training_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_professional_id_professionals_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_profiles" ADD CONSTRAINT "health_profiles_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_source_id_knowledge_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."knowledge_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "physical_assessments" ADD CONSTRAINT "physical_assessments_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "physical_assessments" ADD CONSTRAINT "physical_assessments_created_by_professionals_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."professionals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_records" ADD CONSTRAINT "progress_records_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_records" ADD CONSTRAINT "progress_records_assessment_id_physical_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."physical_assessments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_drafts" ADD CONSTRAINT "student_drafts_professional_id_professionals_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_professional_id_professionals_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_plan_revisions" ADD CONSTRAINT "training_plan_revisions_plan_id_training_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."training_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_plan_revisions" ADD CONSTRAINT "training_plan_revisions_edited_by_professionals_id_fk" FOREIGN KEY ("edited_by") REFERENCES "public"."professionals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_plans" ADD CONSTRAINT "training_plans_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_plans" ADD CONSTRAINT "training_plans_professional_id_professionals_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_preferences" ADD CONSTRAINT "training_preferences_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_plan_id_training_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."training_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_logged_by_professionals_id_fk" FOREIGN KEY ("logged_by") REFERENCES "public"."professionals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_runs_professional_idx" ON "ai_runs" USING btree ("professional_id");--> statement-breakpoint
CREATE INDEX "ai_runs_plan_idx" ON "ai_runs" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "ai_runs_kind_idx" ON "ai_runs" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "ai_runs_status_idx" ON "ai_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ai_runs_created_idx" ON "ai_runs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_log_professional_idx" ON "audit_log" USING btree ("professional_id");--> statement-breakpoint
CREATE INDEX "audit_log_action_idx" ON "audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_log_created_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "clinical_rules_code_idx" ON "clinical_rules" USING btree ("code");--> statement-breakpoint
CREATE INDEX "clinical_rules_active_idx" ON "clinical_rules" USING btree ("active");--> statement-breakpoint
CREATE UNIQUE INDEX "condition_taxonomy_tag_idx" ON "condition_taxonomy" USING btree ("tag");--> statement-breakpoint
CREATE INDEX "health_profiles_student_idx" ON "health_profiles" USING btree ("student_id");--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_chunks_content_idx" ON "knowledge_chunks" USING btree ("source_id","content_hash");--> statement-breakpoint
CREATE INDEX "knowledge_chunks_source_idx" ON "knowledge_chunks" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "knowledge_chunks_embedding_idx" ON "knowledge_chunks" USING ivfflat ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_sources_hash_idx" ON "knowledge_sources" USING btree ("file_hash");--> statement-breakpoint
CREATE INDEX "knowledge_sources_org_idx" ON "knowledge_sources" USING btree ("organization");--> statement-breakpoint
CREATE INDEX "physical_assessments_student_idx" ON "physical_assessments" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "physical_assessments_assessed_at_idx" ON "physical_assessments" USING btree ("assessed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "professionals_email_idx" ON "professionals" USING btree ("email");--> statement-breakpoint
CREATE INDEX "progress_records_student_idx" ON "progress_records" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "progress_records_metric_idx" ON "progress_records" USING btree ("student_id","metric_type","recorded_at");--> statement-breakpoint
CREATE INDEX "student_drafts_professional_idx" ON "student_drafts" USING btree ("professional_id");--> statement-breakpoint
CREATE INDEX "students_professional_idx" ON "students" USING btree ("professional_id");--> statement-breakpoint
CREATE INDEX "students_deleted_idx" ON "students" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "plan_revisions_unique_idx" ON "training_plan_revisions" USING btree ("plan_id","revision_number");--> statement-breakpoint
CREATE INDEX "plan_revisions_plan_idx" ON "training_plan_revisions" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "training_plans_student_idx" ON "training_plans" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "training_plans_professional_idx" ON "training_plans" USING btree ("professional_id");--> statement-breakpoint
CREATE INDEX "training_plans_status_idx" ON "training_plans" USING btree ("status");--> statement-breakpoint
CREATE INDEX "training_preferences_student_idx" ON "training_preferences" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "training_sessions_student_idx" ON "training_sessions" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "training_sessions_plan_idx" ON "training_sessions" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "training_sessions_date_idx" ON "training_sessions" USING btree ("session_date");