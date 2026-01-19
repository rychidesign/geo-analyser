import { ipcMain } from 'electron';
import * as db from '../database/operations';
import { safeStorage } from 'electron';

// ============================================
// SETTINGS HANDLERS
// ============================================

ipcMain.handle('settings:save', async (_, provider: string, apiKey: string, model: string) => {
  try {
    // Encrypt the API key using Electron's safeStorage
    const encryptedKey = safeStorage.encryptString(apiKey).toString('base64');
    
    const setting = await db.saveSetting({
      provider,
      encryptedKey,
      model,
      isActive: true,
    });
    
    // Return status without exposing the key
    return {
      success: true,
      provider: setting.provider,
      model: setting.model,
      isConfigured: true,
    };
  } catch (error) {
    console.error('Failed to save setting:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('settings:get', async (_, provider: string) => {
  try {
    const setting = await db.getSetting(provider);
    
    if (!setting) {
      return { success: true, isConfigured: false };
    }
    
    return {
      success: true,
      provider: setting.provider,
      model: setting.model,
      isActive: setting.isActive,
      isConfigured: true,
    };
  } catch (error) {
    console.error('Failed to get setting:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('settings:getAll', async () => {
  try {
    const settings = await db.getAllSettings();
    
    // Map to safe format without exposing keys
    const safeSett = settings.map((s) => ({
      provider: s.provider,
      model: s.model,
      isActive: s.isActive,
      isConfigured: true,
    }));
    
    return { success: true, settings: safeSett };
  } catch (error) {
    console.error('Failed to get all settings:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('settings:verify', async (_, provider: string) => {
  try {
    const setting = await db.getSetting(provider);
    
    if (!setting) {
      return { success: false, error: 'Provider not configured' };
    }
    
    // Decrypt the key
    const encryptedBuffer = Buffer.from(setting.encryptedKey, 'base64');
    const apiKey = safeStorage.decryptString(encryptedBuffer);
    
    // TODO: Actually test the API key with a simple request
    // For now, just check if decryption worked
    if (apiKey && apiKey.length > 0) {
      return { success: true, isValid: true };
    }
    
    return { success: false, error: 'Invalid API key' };
  } catch (error) {
    console.error('Failed to verify setting:', error);
    return { success: false, error: String(error) };
  }
});

// Helper function to get decrypted API key (used internally by scanning)
export async function getDecryptedApiKey(provider: string): Promise<string | null> {
  try {
    const setting = await db.getSetting(provider);
    if (!setting) return null;
    
    const encryptedBuffer = Buffer.from(setting.encryptedKey, 'base64');
    return safeStorage.decryptString(encryptedBuffer);
  } catch (error) {
    console.error('Failed to decrypt API key:', error);
    return null;
  }
}

// ============================================
// PROJECT HANDLERS
// ============================================

ipcMain.handle('projects:create', async (_, data) => {
  try {
    const project = await db.createProject(data);
    return { success: true, project };
  } catch (error) {
    console.error('Failed to create project:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('projects:getAll', async () => {
  try {
    const projects = await db.getAllProjects();
    return { success: true, projects };
  } catch (error) {
    console.error('Failed to get projects:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('projects:get', async (_, id: string) => {
  try {
    const project = await db.getProject(id);
    return { success: true, project };
  } catch (error) {
    console.error('Failed to get project:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('projects:update', async (_, id: string, data) => {
  try {
    const project = await db.updateProject(id, data);
    return { success: true, project };
  } catch (error) {
    console.error('Failed to update project:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('projects:delete', async (_, id: string) => {
  try {
    await db.deleteProject(id);
    return { success: true };
  } catch (error) {
    console.error('Failed to delete project:', error);
    return { success: false, error: String(error) };
  }
});

// ============================================
// PROJECT QUERY HANDLERS
// ============================================

ipcMain.handle('queries:create', async (_, data) => {
  try {
    const query = await db.createProjectQuery(data);
    return { success: true, query };
  } catch (error) {
    console.error('Failed to create query:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('queries:getByProject', async (_, projectId: string) => {
  try {
    const queries = await db.getProjectQueries(projectId);
    return { success: true, queries };
  } catch (error) {
    console.error('Failed to get queries:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('queries:update', async (_, id: string, data) => {
  try {
    const query = await db.updateProjectQuery(id, data);
    return { success: true, query };
  } catch (error) {
    console.error('Failed to update query:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('queries:delete', async (_, id: string) => {
  try {
    await db.deleteProjectQuery(id);
    return { success: true };
  } catch (error) {
    console.error('Failed to delete query:', error);
    return { success: false, error: String(error) };
  }
});

// ============================================
// SCAN HANDLERS
// ============================================

ipcMain.handle('scans:create', async (_, projectId: string) => {
  try {
    const scan = await db.createScan({
      projectId,
      status: 'running',
      overallScore: null,
      completedAt: null,
    });
    return { success: true, scan };
  } catch (error) {
    console.error('Failed to create scan:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('scans:getByProject', async (_, projectId: string) => {
  try {
    const scans = await db.getProjectScans(projectId);
    return { success: true, scans };
  } catch (error) {
    console.error('Failed to get scans:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('scans:get', async (_, id: string) => {
  try {
    const scan = await db.getScan(id);
    return { success: true, scan };
  } catch (error) {
    console.error('Failed to get scan:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('scans:getResults', async (_, scanId: string) => {
  try {
    const results = await db.getScanResults(scanId);
    return { success: true, results };
  } catch (error) {
    console.error('Failed to get scan results:', error);
    return { success: false, error: String(error) };
  }
});

// ============================================
// SCAN HANDLERS
// ============================================

import { runScan, generateQueries } from '../scanner/engine';

ipcMain.handle('scan:run', async (event, projectId: string) => {
  try {
    const scanId = await runScan(projectId, (progress) => {
      // Send progress updates to renderer
      event.sender.send('scan:progress', progress);
    });
    
    return { success: true, scanId };
  } catch (error) {
    console.error('Failed to run scan:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('queries:generate', async (_, brandVariations: string[], domain: string, keywords: string[], language: string, includeBrand: boolean = false) => {
  try {
    const queries = await generateQueries(brandVariations, domain, keywords, language, includeBrand);
    return { success: true, queries };
  } catch (error) {
    console.error('Failed to generate queries:', error);
    return { success: false, error: String(error) };
  }
});

// ============================================
// INITIALIZE ALL HANDLERS
// ============================================

export function initializeIpcHandlers() {
  console.log('IPC handlers initialized');
}
