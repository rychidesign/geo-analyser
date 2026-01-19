import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { Play, Settings as SettingsIcon } from 'lucide-react';
import { EditProjectDialog } from './EditProjectDialog';
import { QueryManager } from './QueryManager';
import { OverallScoreChart } from './OverallScoreChart';
import { useToast } from '../hooks/use-toast';

interface Project {
  id: string;
  name: string;
  domain: string;
  brandVariations: string;
  targetKeywords: string;
  language: string;
  createdAt: number;
}

interface ProjectViewProps {
  projectId: string;
  onProjectDeleted: () => void;
  onViewScanResults: (scanId: string) => void;
}

export function ProjectView({ projectId, onProjectDeleted, onViewScanResults }: ProjectViewProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState({ total: 0, completed: 0, current: '' });
  const [scans, setScans] = useState<any[]>([]);
  const [queries, setQueries] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    loadProject();
    loadScans();
    loadQueries();

    // Subscribe to scan progress
    const unsubscribe = window.electronAPI.scans.onProgress((progress: any) => {
      setScanProgress(progress);
    });

    return () => {
      unsubscribe();
    };
  }, [projectId]);

  const loadProject = async () => {
    setLoading(true);
    try {
      const result = await window.electronAPI.projects.get(projectId);
      if (result.success && result.project) {
        setProject(result.project);
      }
    } catch (error) {
      console.error('Failed to load project:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadScans = async () => {
    try {
      const result = await window.electronAPI.scans.getByProject(projectId);
      if (result.success && result.scans) {
        setScans(result.scans);
      }
    } catch (error) {
      console.error('Failed to load scans:', error);
    }
  };

  const loadQueries = async () => {
    try {
      const result = await window.electronAPI.queries.getByProject(projectId);
      if (result.success && result.queries) {
        setQueries(result.queries);
      }
    } catch (error) {
      console.error('Failed to load queries:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-zinc-500">Loading...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-zinc-500">Project not found</div>
      </div>
    );
  }

  const brandVariations = JSON.parse(project.brandVariations || '[]');
  const targetKeywords = JSON.parse(project.targetKeywords || '[]');

  return (
    <TooltipProvider>
      <div className="p-6 max-w-6xl mx-auto">
        {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-light tracking-tight mb-1">{project.name}</h1>
            <a
              href={`https://${project.domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-zinc-500 hover:text-zinc-400"
            >
              {project.domain}
            </a>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setShowEditDialog(true)}>
            <SettingsIcon className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <Tooltip>
          <TooltipTrigger asChild>
            <Card className="cursor-help">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-normal text-zinc-500">Total Scans</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-light">{scans.length}</div>
              </CardContent>
            </Card>
          </TooltipTrigger>
          <TooltipContent>
            <p>Total number of scan runs for this project</p>
          </TooltipContent>
        </Tooltip>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <Card className="cursor-help">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-normal text-zinc-500">Avg. Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-light">
                  {scans.length > 0 && scans.some(s => s.overallScore)
                    ? Math.round(
                        scans
                          .filter(s => s.overallScore)
                          .reduce((sum, s) => sum + s.overallScore, 0) / 
                        scans.filter(s => s.overallScore).length
                      )
                    : '-'}
                </div>
              </CardContent>
            </Card>
          </TooltipTrigger>
          <TooltipContent>
            <p>Average overall score across all completed scans</p>
          </TooltipContent>
        </Tooltip>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <Card className="cursor-help">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-normal text-zinc-500">Queries</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-light">{queries.length}</div>
              </CardContent>
            </Card>
          </TooltipTrigger>
          <TooltipContent>
            <p>Number of test queries configured for this project</p>
          </TooltipContent>
        </Tooltip>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal text-zinc-500">Visibility</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-light">-%</div>
          </CardContent>
        </Card>
      </div>

      {/* Overall Score Chart */}
      {scans.length > 0 && (
        <div className="mb-4">
          <OverallScoreChart scans={scans} />
        </div>
      )}

      {/* Actions */}
      <div className="mb-8">
        <Button
          className="gap-2"
          onClick={async () => {
            setScanning(true);
            try {
              const result = await window.electronAPI.scans.run(projectId);
              if (result.success) {
                // Reload scans to show the new one
                await loadScans();
                
                toast({
                  title: 'Scan Completed',
                  description: 'View results in the Recent Scans section',
                });
                
                // Navigate to scan results if scanId is returned
                if (result.scanId) {
                  onViewScanResults(result.scanId);
                }
              } else {
                throw new Error(result.error);
              }
            } catch (error) {
              toast({
                title: 'Scan Failed',
                description: String(error),
                variant: 'destructive',
              });
            } finally {
              setScanning(false);
            }
          }}
          disabled={scanning}
        >
          <Play className="w-4 h-4" />
          {scanning ? 'Running Scan...' : 'Run Scan'}
        </Button>
        
        {scanning && (
          <div className="mt-4 text-sm text-zinc-500">
            <div className="mb-1">
              Progress: {scanProgress.completed} / {scanProgress.total}
            </div>
            <div className="text-xs">{scanProgress.current}</div>
          </div>
        )}
      </div>

      {/* Query Manager */}
      <QueryManager
        projectId={projectId}
        brandVariations={brandVariations}
        domain={project.domain}
        keywords={targetKeywords}
        language={project.language || 'en'}
      />

      {/* Project Details */}
      <div className="grid grid-cols-2 gap-6 mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Brand Variations</CardTitle>
            <CardDescription>Different ways your brand might be mentioned</CardDescription>
          </CardHeader>
          <CardContent>
            {brandVariations.length === 0 ? (
              <p className="text-sm text-zinc-500">No brand variations added</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {brandVariations.map((brand: string, i: number) => (
                  <span
                    key={i}
                    className="px-2 py-1 bg-zinc-800 text-zinc-300 text-sm"
                  >
                    {brand}
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Target Keywords</CardTitle>
            <CardDescription>Keywords to track in AI responses</CardDescription>
          </CardHeader>
          <CardContent>
            {targetKeywords.length === 0 ? (
              <p className="text-sm text-zinc-500">No keywords added</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {targetKeywords.map((keyword: string, i: number) => (
                  <span
                    key={i}
                    className="px-2 py-1 bg-zinc-800 text-zinc-300 text-sm"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Scans */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recent Scans</CardTitle>
          <CardDescription>History of your GEO scans</CardDescription>
        </CardHeader>
        <CardContent>
          {scans.length === 0 ? (
            <div className="text-center py-12 text-zinc-600">
              <Play className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No scans yet</p>
              <p className="text-xs mt-1">Run your first scan to see results here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {scans.map((scan: any) => (
                <div
                  key={scan.id}
                  className="flex items-center justify-between p-4 bg-zinc-800/50 hover:bg-zinc-800 cursor-pointer transition-colors"
                  onClick={() => onViewScanResults(scan.id)}
                >
                  <div>
                    <div className="text-sm font-medium">
                      {typeof scan.createdAt === 'number' 
                        ? new Date(scan.createdAt * 1000).toLocaleString()
                        : new Date(scan.createdAt).toLocaleString()}
                    </div>
                    <div className="text-xs text-zinc-500 mt-1">
                      Status: <span className={scan.status === 'completed' ? 'text-green-500' : scan.status === 'failed' ? 'text-red-500' : 'text-yellow-500'}>
                        {scan.status}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    {scan.overallScore ? (
                      <div className="text-xl font-light">{scan.overallScore}</div>
                    ) : (
                      <div className="text-sm text-zinc-500">-</div>
                    )}
                    <div className="text-xs text-zinc-500">Overall Score</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <EditProjectDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        projectId={projectId}
        onProjectUpdated={loadProject}
        onProjectDeleted={onProjectDeleted}
      />
      </div>
    </TooltipProvider>
  );
}
