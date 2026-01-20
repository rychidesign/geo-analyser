import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export interface ScanJob {
  id: string;
  projectId: string;
  status: 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  progress: { total: number; completed: number; current: string };
  scanId?: string;
  error?: string;
  startedAt?: number;
  completedAt?: number;
}

interface ScanQueueContextType {
  jobs: ScanJob[];
  getProjectJobs: (projectId: string) => ScanJob[];
  getActiveProjectJob: (projectId: string) => ScanJob | null;
  pauseScan: (jobId: string) => Promise<void>;
  resumeScan: (jobId: string) => Promise<void>;
  cancelScan: (jobId: string) => Promise<void>;
}

const ScanQueueContext = createContext<ScanQueueContextType | null>(null);

export function ScanQueueProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<ScanJob[]>([]);

  useEffect(() => {
    // Load initial jobs
    loadJobs();

    // Subscribe to queue updates
    const unsubscribe = window.electronAPI.scans.onQueueUpdated((updatedJobs: ScanJob[]) => {
      setJobs(updatedJobs);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const loadJobs = async () => {
    const result = await window.electronAPI.scans.getAllJobs();
    if (result.success && result.jobs) {
      setJobs(result.jobs);
    }
  };

  const getProjectJobs = (projectId: string): ScanJob[] => {
    return jobs.filter(job => job.projectId === projectId);
  };

  const getActiveProjectJob = (projectId: string): ScanJob | null => {
    const activeJob = jobs.find(
      job => job.projectId === projectId && 
      (job.status === 'running' || job.status === 'paused' || job.status === 'queued')
    );
    return activeJob || null;
  };

  const pauseScan = async (jobId: string) => {
    await window.electronAPI.scans.pause(jobId);
  };

  const resumeScan = async (jobId: string) => {
    await window.electronAPI.scans.resume(jobId);
  };

  const cancelScan = async (jobId: string) => {
    await window.electronAPI.scans.cancel(jobId);
  };

  return (
    <ScanQueueContext.Provider value={{
      jobs,
      getProjectJobs,
      getActiveProjectJob,
      pauseScan,
      resumeScan,
      cancelScan,
    }}>
      {children}
    </ScanQueueContext.Provider>
  );
}

export function useScanQueue() {
  const context = useContext(ScanQueueContext);
  if (!context) {
    throw new Error('useScanQueue must be used within ScanQueueProvider');
  }
  return context;
}
