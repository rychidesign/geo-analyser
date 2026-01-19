import { eq, desc, and } from 'drizzle-orm';
import { getDatabase, schema } from './index';
import { randomUUID } from 'crypto';

// ============================================
// SETTINGS OPERATIONS
// ============================================

export async function saveSetting(setting: schema.InsertSetting) {
  const db = getDatabase();
  return db
    .insert(schema.settings)
    .values(setting)
    .onConflictDoUpdate({
      target: schema.settings.provider,
      set: setting,
    })
    .returning()
    .get();
}

export async function getSetting(provider: string) {
  const db = getDatabase();
  return db
    .select()
    .from(schema.settings)
    .where(eq(schema.settings.provider, provider))
    .get();
}

export async function getAllSettings() {
  const db = getDatabase();
  return db.select().from(schema.settings).all();
}

export async function getActiveSettings() {
  const db = getDatabase();
  return db
    .select()
    .from(schema.settings)
    .where(eq(schema.settings.isActive, true))
    .all();
}

// ============================================
// PROJECT OPERATIONS
// ============================================

export async function createProject(project: Omit<schema.InsertProject, 'id'>) {
  const db = getDatabase();
  const newProject: schema.InsertProject = {
    id: randomUUID(),
    ...project,
  };
  return db.insert(schema.projects).values(newProject).returning().get();
}

export async function getProject(id: string) {
  const db = getDatabase();
  return db.select().from(schema.projects).where(eq(schema.projects.id, id)).get();
}

export async function getAllProjects() {
  const db = getDatabase();
  return db.select().from(schema.projects).orderBy(desc(schema.projects.createdAt)).all();
}

export async function updateProject(id: string, data: Partial<schema.Project>) {
  const db = getDatabase();
  return db
    .update(schema.projects)
    .set(data)
    .where(eq(schema.projects.id, id))
    .returning()
    .get();
}

export async function deleteProject(id: string) {
  const db = getDatabase();
  return db.delete(schema.projects).where(eq(schema.projects.id, id)).run();
}

// ============================================
// PROJECT QUERY OPERATIONS
// ============================================

export async function createProjectQuery(
  query: Omit<schema.InsertProjectQuery, 'id'>
) {
  const db = getDatabase();
  const newQuery: schema.InsertProjectQuery = {
    id: randomUUID(),
    ...query,
  };
  return db.insert(schema.projectQueries).values(newQuery).returning().get();
}

export async function getProjectQueries(projectId: string) {
  const db = getDatabase();
  return db
    .select()
    .from(schema.projectQueries)
    .where(eq(schema.projectQueries.projectId, projectId))
    .all();
}

export async function getActiveProjectQueries(projectId: string) {
  const db = getDatabase();
  return db
    .select()
    .from(schema.projectQueries)
    .where(and(
      eq(schema.projectQueries.projectId, projectId),
      eq(schema.projectQueries.isActive, true)
    ))
    .all();
}

export async function updateProjectQuery(
  id: string,
  data: Partial<schema.ProjectQuery>
) {
  const db = getDatabase();
  return db
    .update(schema.projectQueries)
    .set(data)
    .where(eq(schema.projectQueries.id, id))
    .returning()
    .get();
}

export async function deleteProjectQuery(id: string) {
  const db = getDatabase();
  return db.delete(schema.projectQueries).where(eq(schema.projectQueries.id, id)).run();
}

// ============================================
// SCAN OPERATIONS
// ============================================

export async function createScan(scan: Omit<schema.InsertScan, 'id'>) {
  const db = getDatabase();
  const newScan: schema.InsertScan = {
    id: randomUUID(),
    ...scan,
  };
  return db.insert(schema.scans).values(newScan).returning().get();
}

export async function getScan(id: string) {
  const db = getDatabase();
  return db.select().from(schema.scans).where(eq(schema.scans.id, id)).get();
}

export async function getProjectScans(projectId: string) {
  const db = getDatabase();
  return db
    .select()
    .from(schema.scans)
    .where(eq(schema.scans.projectId, projectId))
    .orderBy(desc(schema.scans.createdAt))
    .all();
}

export async function updateScan(id: string, data: Partial<schema.Scan>) {
  const db = getDatabase();
  return db.update(schema.scans).set(data).where(eq(schema.scans.id, id)).returning().get();
}

// ============================================
// SCAN RESULT OPERATIONS
// ============================================

export async function createScanResult(result: Omit<schema.InsertScanResult, 'id'>) {
  const db = getDatabase();
  const newResult: schema.InsertScanResult = {
    id: randomUUID(),
    ...result,
  };
  return db.insert(schema.scanResults).values(newResult).returning().get();
}

export async function getScanResults(scanId: string) {
  const db = getDatabase();
  return db
    .select()
    .from(schema.scanResults)
    .where(eq(schema.scanResults.scanId, scanId))
    .all();
}

export async function updateScanResult(id: string, data: Partial<schema.ScanResult>) {
  const db = getDatabase();
  return db.update(schema.scanResults).set(data).where(eq(schema.scanResults.id, id)).returning().get();
}
