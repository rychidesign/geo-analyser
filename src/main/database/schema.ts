import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Settings table - stores encrypted API keys for LLM providers
export const settings = sqliteTable('settings', {
  provider: text('provider').primaryKey(), // openai, anthropic, google, perplexity
  encryptedKey: text('encrypted_key').notNull(),
  model: text('model').notNull(), // e.g., gpt-4o, claude-3-sonnet
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
});

// Projects table - main entity for organizing GEO tracking
export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(), // UUID
  name: text('name').notNull(),
  domain: text('domain').notNull(),
  brandVariations: text('brand_variations').notNull(), // JSON array
  targetKeywords: text('target_keywords').notNull(), // JSON array
  language: text('language').notNull().default('en'), // cs, sk, en, de, other
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
});

// Project queries - specific questions to ask LLMs
export const projectQueries = sqliteTable('project_queries', {
  id: text('id').primaryKey(), // UUID
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  queryText: text('query_text').notNull(),
  type: text('type').notNull(), // informational, transactional, comparison
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
});

// Scans - represents a scanning session
export const scans = sqliteTable('scans', {
  id: text('id').primaryKey(), // UUID
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
  status: text('status').notNull(), // running, completed, failed
  overallScore: integer('overall_score'), // 0-100
  completedAt: integer('completed_at', { mode: 'timestamp' }),
});

// Scan results - individual LLM responses with evaluation metrics
export const scanResults = sqliteTable('scan_results', {
  id: text('id').primaryKey(), // UUID
  scanId: text('scan_id')
    .notNull()
    .references(() => scans.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(), // openai, anthropic, google, perplexity
  queryText: text('query_text').notNull(),
  aiResponseRaw: text('ai_response_raw').notNull(),
  metricsJson: text('metrics_json'), // JSON: {is_visible, sentiment_score, citation_found, ranking_position, recommendation_strength}
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
});

// Export types for TypeScript
export type Setting = typeof settings.$inferSelect;
export type InsertSetting = typeof settings.$inferInsert;

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

export type ProjectQuery = typeof projectQueries.$inferSelect;
export type InsertProjectQuery = typeof projectQueries.$inferInsert;

export type Scan = typeof scans.$inferSelect;
export type InsertScan = typeof scans.$inferInsert;

export type ScanResult = typeof scanResults.$inferSelect;
export type InsertScanResult = typeof scanResults.$inferInsert;
