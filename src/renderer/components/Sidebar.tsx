import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Settings as SettingsIcon, Plus, FolderOpen, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { useScanQueue } from '../contexts/ScanQueueContext';

interface Project {
  id: string;
  name: string;
  domain: string;
}

interface SidebarProps {
  currentView: 'settings' | 'project' | 'scan-results';
  currentProjectId?: string;
  onViewChange: (view: 'settings' | 'project' | 'scan-results', projectId?: string) => void;
  onNewProject: () => void;
}

export function Sidebar({ currentView, currentProjectId, onViewChange, onNewProject }: SidebarProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const { getActiveProjectJob } = useScanQueue();

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const result = await window.electronAPI.projects.getAll();
      if (result.success && result.projects) {
        setProjects(result.projects);
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  };

  // Refresh projects when view changes or projectId changes
  useEffect(() => {
    loadProjects();
  }, [currentView, currentProjectId]);

  return (
    <div className="w-64 h-screen bg-zinc-900 flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-zinc-800">
        <h1 className="text-lg font-light tracking-tight">GEO Analyser</h1>
        <p className="text-xs text-zinc-500 mt-1">Generative Engine Optimization</p>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="space-y-1">
          {/* Settings */}
          <button
            onClick={() => onViewChange('settings')}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors',
              currentView === 'settings'
                ? 'bg-zinc-800 text-zinc-100'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50'
            )}
          >
            <SettingsIcon className="w-4 h-4" />
            Settings
          </button>

          {/* Divider */}
          <div className="py-2">
            <div className="h-px bg-zinc-800" />
          </div>

          {/* Projects Header */}
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-xs font-medium text-zinc-500">PROJECTS</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onNewProject}
            >
              <Plus className="w-3 h-3" />
            </Button>
          </div>

          {/* Projects List */}
          {projects.length === 0 ? (
            <div className="px-3 py-8 text-center">
              <FolderOpen className="w-8 h-8 mx-auto text-zinc-700 mb-2" />
              <p className="text-xs text-zinc-600">No projects yet</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={onNewProject}
                className="mt-2 text-xs"
              >
                Create your first
              </Button>
            </div>
          ) : (
            <div className="space-y-1">
              {projects.map((project) => {
                const activeJob = getActiveProjectJob(project.id);
                return (
                  <button
                    key={project.id}
                    onClick={() => onViewChange('project', project.id)}
                    className={cn(
                      'w-full text-left px-3 py-2 text-sm transition-colors relative',
                      currentView === 'project' && currentProjectId === project.id
                        ? 'bg-zinc-800 text-zinc-100'
                        : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <div className="font-medium">{project.name}</div>
                        <div className="text-xs text-zinc-600 truncate">{project.domain}</div>
                      </div>
                      {activeJob && (
                        <div className="flex-shrink-0">
                          {activeJob.status === 'running' && (
                            <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                          )}
                          {activeJob.status === 'paused' && (
                            <div className="w-3 h-3 rounded-full bg-yellow-500" />
                          )}
                          {activeJob.status === 'queued' && (
                            <div className="w-3 h-3 rounded-full bg-zinc-500" />
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-zinc-800">
        <div className="text-xs text-zinc-500">
          Version <span className="text-zinc-400">1.0.7</span>
        </div>
      </div>
    </div>
  );
}
