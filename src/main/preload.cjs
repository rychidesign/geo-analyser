const { contextBridge, ipcRenderer } = require('electron');

// Type-safe IPC API (types are only for development, not runtime)
const electronAPI = {
  ping: () => ipcRenderer.invoke('ping'),
  
  settings: {
    save: (provider, apiKey, model) => 
      ipcRenderer.invoke('settings:save', provider, apiKey, model),
    get: (provider) => 
      ipcRenderer.invoke('settings:get', provider),
    getAll: () => 
      ipcRenderer.invoke('settings:getAll'),
    verify: (provider) => 
      ipcRenderer.invoke('settings:verify', provider),
  },
  
  projects: {
    create: (data) => 
      ipcRenderer.invoke('projects:create', data),
    getAll: () => 
      ipcRenderer.invoke('projects:getAll'),
    get: (id) => 
      ipcRenderer.invoke('projects:get', id),
    update: (id, data) => 
      ipcRenderer.invoke('projects:update', id, data),
    delete: (id) => 
      ipcRenderer.invoke('projects:delete', id),
  },
  
  queries: {
    create: (data) => 
      ipcRenderer.invoke('queries:create', data),
    getByProject: (projectId) => 
      ipcRenderer.invoke('queries:getByProject', projectId),
    update: (id, data) => 
      ipcRenderer.invoke('queries:update', id, data),
    delete: (id) => 
      ipcRenderer.invoke('queries:delete', id),
          generate: (brandVariations, domain, keywords, language, includeBrand) =>
            ipcRenderer.invoke('queries:generate', brandVariations, domain, keywords, language, includeBrand),
  },
  
  scans: {
    create: (projectId) => 
      ipcRenderer.invoke('scans:create', projectId),
    getByProject: (projectId) => 
      ipcRenderer.invoke('scans:getByProject', projectId),
    get: (id) => 
      ipcRenderer.invoke('scans:get', id),
    getResults: (scanId) => 
      ipcRenderer.invoke('scans:getResults', scanId),
    run: (projectId) => 
      ipcRenderer.invoke('scan:run', projectId),
    pause: (jobId) => 
      ipcRenderer.invoke('scan:pause', jobId),
    resume: (jobId) => 
      ipcRenderer.invoke('scan:resume', jobId),
    cancel: (jobId) => 
      ipcRenderer.invoke('scan:cancel', jobId),
    getAllJobs: () => 
      ipcRenderer.invoke('scan:get-all-jobs'),
    getProjectJobs: (projectId) => 
      ipcRenderer.invoke('scan:get-project-jobs', projectId),
    onProgress: (callback) => {
      const subscription = (event, progress) => callback(progress);
      ipcRenderer.on('scan:progress', subscription);
      return () => ipcRenderer.removeListener('scan:progress', subscription);
    },
    onQueueUpdated: (callback) => {
      const subscription = (event, jobs) => callback(jobs);
      ipcRenderer.on('scan:queue-updated', subscription);
      return () => ipcRenderer.removeListener('scan:queue-updated', subscription);
    },
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
