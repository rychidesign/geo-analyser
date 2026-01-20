// Scan Queue Manager
// Manages multiple concurrent scans with pause/resume/stop functionality

import { EventEmitter } from 'events';
import { runScan } from './engine';

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

class ScanQueueManager extends EventEmitter {
  private queue: ScanJob[] = [];
  private currentJob: ScanJob | null = null;
  private isPaused: boolean = false;
  private abortController: AbortController | null = null;

  // Add scan to queue
  async enqueueScan(projectId: string): Promise<string> {
    const jobId = `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const job: ScanJob = {
      id: jobId,
      projectId,
      status: 'queued',
      progress: { total: 0, completed: 0, current: 'Waiting in queue...' },
    };

    this.queue.push(job);
    this.emit('queue-updated', this.getAllJobs());
    
    // Start processing if not already running
    if (!this.currentJob) {
      this.processNext();
    }

    return jobId;
  }

  // Process next scan in queue
  private async processNext() {
    if (this.isPaused || this.currentJob) {
      return;
    }

    const nextJob = this.queue.find(j => j.status === 'queued');
    if (!nextJob) {
      return;
    }

    this.currentJob = nextJob;
    nextJob.status = 'running';
    nextJob.startedAt = Date.now();
    this.emit('queue-updated', this.getAllJobs());

    try {
      this.abortController = new AbortController();
      
      const scanId = await runScan(nextJob.projectId, (progress) => {
        if (nextJob.status === 'running') {
          nextJob.progress = progress;
          this.emit('queue-updated', this.getAllJobs());
        }
      });

      nextJob.scanId = scanId;
      nextJob.status = 'completed';
      nextJob.completedAt = Date.now();
    } catch (error) {
      nextJob.status = 'failed';
      nextJob.error = String(error);
      nextJob.completedAt = Date.now();
    }

    this.emit('queue-updated', this.getAllJobs());
    this.currentJob = null;

    // Process next job
    setTimeout(() => this.processNext(), 100);
  }

  // Pause current scan
  pauseScan(jobId: string): boolean {
    const job = this.findJob(jobId);
    if (!job || job.status !== 'running') {
      return false;
    }

    job.status = 'paused';
    this.isPaused = true;
    this.emit('queue-updated', this.getAllJobs());
    return true;
  }

  // Resume paused scan
  resumeScan(jobId: string): boolean {
    const job = this.findJob(jobId);
    if (!job || job.status !== 'paused') {
      return false;
    }

    job.status = 'running';
    this.isPaused = false;
    this.emit('queue-updated', this.getAllJobs());
    
    // Continue processing
    this.processNext();
    return true;
  }

  // Cancel scan
  cancelScan(jobId: string): boolean {
    const job = this.findJob(jobId);
    if (!job) {
      return false;
    }

    if (job.status === 'running') {
      this.abortController?.abort();
      this.currentJob = null;
    }

    job.status = 'cancelled';
    job.completedAt = Date.now();
    
    // Remove from queue
    this.queue = this.queue.filter(j => j.id !== jobId);
    
    this.emit('queue-updated', this.getAllJobs());
    
    // Process next job
    setTimeout(() => this.processNext(), 100);
    return true;
  }

  // Get all jobs
  getAllJobs(): ScanJob[] {
    return [...this.queue, ...(this.currentJob ? [this.currentJob] : [])];
  }

  // Get jobs by project
  getJobsByProject(projectId: string): ScanJob[] {
    return this.getAllJobs().filter(j => j.projectId === projectId);
  }

  // Find job by ID
  private findJob(jobId: string): ScanJob | null {
    if (this.currentJob?.id === jobId) {
      return this.currentJob;
    }
    return this.queue.find(j => j.id === jobId) || null;
  }

  // Get job by ID (public)
  getJob(jobId: string): ScanJob | null {
    return this.findJob(jobId);
  }
}

// Singleton instance
export const scanQueue = new ScanQueueManager();
