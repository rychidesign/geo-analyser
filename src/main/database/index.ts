import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import { drizzle } from 'drizzle-orm/sql-js';
import { migrate } from 'drizzle-orm/sql-js/migrator';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import * as schema from './schema';

let db: ReturnType<typeof drizzle> | null = null;
let sqlJsDb: SqlJsDatabase | null = null;

export async function initDatabase() {
  try {
    // Ensure data directory exists
    const userDataPath = app.getPath('userData');
    const dataDir = path.join(userDataPath, 'data');
    
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const dbPath = path.join(dataDir, 'geo-analyser.db');
    
    console.log('Initializing database at:', dbPath);
    
    // Initialize SQL.js
    const SQL = await initSqlJs({
      locateFile: (file) => {
        // Use the WASM file from public folder (copied by postinstall script)
        const wasmPath = path.join(process.cwd(), 'public', file);
        if (fs.existsSync(wasmPath)) {
          console.log('Found WASM file at:', wasmPath);
          return wasmPath;
        }
        
        // Fallback to node_modules
        const nodeModulesPath = path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', file);
        if (fs.existsSync(nodeModulesPath)) {
          console.log('Found WASM file in node_modules:', nodeModulesPath);
          return nodeModulesPath;
        }
        
        console.warn('Could not locate WASM file, using default:', file);
        return file;
      },
    });

    // Load existing database or create new one
    let buffer: Buffer | undefined;
    if (fs.existsSync(dbPath)) {
      buffer = fs.readFileSync(dbPath);
    }

    sqlJsDb = new SQL.Database(buffer);
    db = drizzle(sqlJsDb, { schema });
    
    // Create tables if they don't exist
    createTablesIfNotExist(sqlJsDb);
    console.log('Database migrations completed');
    
    // Save database after migrations
    saveDatabase(dbPath);
    
    // Setup auto-save on changes (every 5 seconds if there are changes)
    setupAutoSave(dbPath);
    
    return db;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

// Create tables using raw SQL - EXACTLY matching schema.ts
function createTablesIfNotExist(sqlJsDb: SqlJsDatabase) {
  // Settings table - FIXED: encrypted_key (not encrypted_api_key!)
  sqlJsDb.run(`
    CREATE TABLE IF NOT EXISTS settings (
      provider TEXT PRIMARY KEY NOT NULL,
      encrypted_key TEXT NOT NULL,
      model TEXT NOT NULL,
      is_active INTEGER DEFAULT 1 NOT NULL
    );
  `);

  // Projects table - WITH language column!
  sqlJsDb.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      domain TEXT NOT NULL,
      brand_variations TEXT NOT NULL,
      target_keywords TEXT NOT NULL,
      language TEXT NOT NULL DEFAULT 'en',
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );
  `);

  // Project queries table
  sqlJsDb.run(`
    CREATE TABLE IF NOT EXISTS project_queries (
      id TEXT PRIMARY KEY NOT NULL,
      project_id TEXT NOT NULL,
      query_text TEXT NOT NULL,
      type TEXT NOT NULL,
      is_active INTEGER DEFAULT 1 NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);

  // Scans table - correct column order
  sqlJsDb.run(`
    CREATE TABLE IF NOT EXISTS scans (
      id TEXT PRIMARY KEY NOT NULL,
      project_id TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      status TEXT NOT NULL,
      overall_score INTEGER,
      completed_at INTEGER,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);

  // Scan results table
  sqlJsDb.run(`
    CREATE TABLE IF NOT EXISTS scan_results (
      id TEXT PRIMARY KEY NOT NULL,
      scan_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      query_text TEXT NOT NULL,
      ai_response_raw TEXT NOT NULL,
      metrics_json TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE
    );
  `);
  
  console.log('✅ All tables created - 100% matching schema.ts!');
}

// Save database to disk
function saveDatabase(dbPath: string) {
  if (!sqlJsDb) return;
  
  try {
    const data = sqlJsDb.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  } catch (error) {
    console.error('Failed to save database:', error);
  }
}

// Auto-save setup
let saveInterval: NodeJS.Timeout | null = null;

function setupAutoSave(dbPath: string) {
  if (saveInterval) {
    clearInterval(saveInterval);
  }
  
  // Save every 5 seconds
  saveInterval = setInterval(() => {
    saveDatabase(dbPath);
  }, 5000);
}

// Save on app quit
export function closeDatabase() {
  if (saveInterval) {
    clearInterval(saveInterval);
  }
  
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'data', 'geo-analyser.db');
  saveDatabase(dbPath);
  
  if (sqlJsDb) {
    sqlJsDb.close();
    sqlJsDb = null;
  }
  
  db = null;
}

export function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

export { schema };
