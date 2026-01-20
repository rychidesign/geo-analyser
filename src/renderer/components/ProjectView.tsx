import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { Play, Pause, Square, Settings as SettingsIcon, Loader2 } from 'lucide-react';
import { EditProjectDialog } from './EditProjectDialog';
import { QueryManager } from './QueryManager';
import { OverallScoreChart } from './OverallScoreChart';
import { useToast } from '../hooks/use-toast';
import { useScanQueue } from '../contexts/ScanQueueContext';

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
  const [scans, setScans] = useState<any[]>([]);
  const [queries, setQueries] = useState<any[]>([]);
  const [metrics, setMetrics] = useState({ visibilityRate: 0, avgSentiment: 0, citationRate: 0 });
  const { toast } = useToast();
  const { getActiveProjectJob, pauseScan, resumeScan, cancelScan } = useScanQueue();
  
  // Get active job for this project
  const activeJob = getActiveProjectJob(projectId);

  useEffect(() => {
    loadProject();
    loadScans();
    loadQueries();
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
        // Calculate metrics from all scans
        await calculateMetrics(result.scans);
      }
    } catch (error) {
      console.error('Failed to load scans:', error);
    }
  };

  const calculateMetrics = async (scansData: any[]) => {
    try {
      // Load results for all scans
      const allResults = await Promise.all(
        scansData.map(async (scan) => {
          const result = await window.electronAPI.scans.getResults(scan.id);
          return result.success ? result.results : [];
        })
      );

      // Flatten all results
      const flatResults = allResults.flat();

      if (flatResults.length === 0) {
        setMetrics({ visibilityRate: 0, avgSentiment: 0, citationRate: 0 });
        return;
      }

      // Calculate visibility rate
      const visibleCount = flatResults.filter((r: any) => {
        const metrics = r.metricsJson ? JSON.parse(r.metricsJson) : null;
        return metrics?.is_visible;
      }).length;
      const visibilityRate = Math.round((visibleCount / flatResults.length) * 100);

      // Calculate avg sentiment
      const sentiments = flatResults
        .map((r: any) => {
          const metrics = r.metricsJson ? JSON.parse(r.metricsJson) : null;
          return metrics?.sentiment_score || 0;
        })
        .filter((s: number) => s !== 0);
      const avgSentiment = sentiments.length > 0
        ? sentiments.reduce((sum: number, s: number) => sum + s, 0) / sentiments.length
        : 0;

      // Calculate citation rate
      const citedCount = flatResults.filter((r: any) => {
        const metrics = r.metricsJson ? JSON.parse(r.metricsJson) : null;
        return metrics?.citation_found;
      }).length;
      const citationRate = Math.round((citedCount / flatResults.length) * 100);

      setMetrics({ visibilityRate, avgSentiment, citationRate });
    } catch (error) {
      console.error('Failed to calculate metrics:', error);
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
        
        <Tooltip>
          <TooltipTrigger asChild>
            <Card className="cursor-help">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-normal text-zinc-500">Visibility</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-light">
                  {scans.length > 0 ? `${metrics.visibilityRate}%` : '-%'}
                </div>
              </CardContent>
            </Card>
          </TooltipTrigger>
          <TooltipContent>
            <p>Percentage of queries where your brand/domain was mentioned in AI responses</p>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Overall Score Chart */}
      {scans.length > 0 && (
        <div className="mb-12">
          <OverallScoreChart scans={scans} />
        </div>
      )}

      {/* Actions */}
      <div className="mb-8">
        {!activeJob ? (
          <Button
            className="gap-2"
            onClick={async () => {
              try {
                const result = await window.electronAPI.scans.run(projectId);
                if (result.success) {
                  toast({
                    title: 'Scan Queued',
                    description: 'Scan has been added to the queue',
                  });
                } else {
                  throw new Error(result.error);
                }
              } catch (error) {
                toast({
                  title: 'Scan Failed',
                  description: String(error),
                  variant: 'destructive',
                });
              }
            }}
          >
            <Play className="w-4 h-4" />
            Run Scan
          </Button>
        ) : (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {activeJob.status === 'running' && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
              <span className="text-sm font-medium">
                {activeJob.status === 'queued' && '⏳ Queued'}
                {activeJob.status === 'running' && '🔄 Running...'}
                {activeJob.status === 'paused' && '⏸️ Paused'}
              </span>
            </div>
            
            <div className="flex gap-2">
              {activeJob.status === 'running' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => pauseScan(activeJob.id)}
                >
                  <Pause className="w-3 h-3" />
                  Pause
                </Button>
              )}
              
              {activeJob.status === 'paused' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => resumeScan(activeJob.id)}
                >
                  <Play className="w-3 h-3" />
                  Resume
                </Button>
              )}
              
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-red-500 hover:text-red-400"
                onClick={() => {
                  cancelScan(activeJob.id);
                  toast({
                    title: 'Scan Cancelled',
                    description: 'The scan has been stopped',
                  });
                }}
              >
                <Square className="w-3 h-3" />
                Cancel
              </Button>
            </div>
          </div>
        )}
        
        {activeJob && activeJob.status === 'running' && (
          <div className="mt-4 text-sm text-zinc-500">
            <div className="mb-1">
              Progress: {activeJob.progress.completed} / {activeJob.progress.total}
            </div>
            <div className="text-xs">{activeJob.progress.current}</div>
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
