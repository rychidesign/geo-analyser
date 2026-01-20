import { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { ArrowLeft, Download } from 'lucide-react';
import { exportScanToPDF } from '../lib/pdf-export';
import { useToast } from '../hooks/use-toast';
import { LoadingState } from './ui/loading-spinner';
import { EmptyState } from './ui/empty-state';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

interface ScanResultsProps {
  scanId: string;
  onBack: () => void;
}

interface ScanResult {
  id: string;
  provider: string;
  queryText: string;
  aiResponseRaw: string;
  metricsJson: string | null;
}

interface Metrics {
  is_visible: boolean;
  sentiment_score: number;
  citation_found: boolean;
  ranking_position: number | null;
  recommendation_strength: number;
}

export function ScanResults({ scanId, onBack }: ScanResultsProps) {
  const [results, setResults] = useState<ScanResult[]>([]);
  const [scan, setScan] = useState<any>(null);
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Highlight helper function - apply BEFORE markdown rendering
  const highlightAndRenderMarkdown = (text: string) => {
    if (!project || !text) return text;

    try {
      const brandVariations = JSON.parse(project.brandVariations || '[]');
      const keywords = JSON.parse(project.targetKeywords || '[]');
      const domain = project.domain;

      // Build regex pattern: brands/domain (green) and keywords (orange)
      const brandPattern = [...brandVariations, domain].filter(Boolean).map((b: string) => 
        b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      ).join('|');
      const keywordPattern = keywords.map((k: string) => 
        k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      ).join('|');

      let result = text;
      
      // Highlight keywords FIRST (orange) - to avoid conflicts with brands
      if (keywordPattern) {
        const keywordRegex = new RegExp(`(${keywordPattern}[a-záčďéěíňóřšťúůýž]*)`, 'gi');
        result = result.replace(keywordRegex, '<mark class="keyword-highlight">$1</mark>');
      }

      // Then highlight brands/domain (green)
      if (brandPattern) {
        const brandRegex = new RegExp(`(${brandPattern})`, 'gi');
        result = result.replace(brandRegex, '<mark class="brand-highlight">$1</mark>');
      }

      return result;
    } catch (error) {
      console.error('Highlighting error:', error);
      return text;
    }
  };

  useEffect(() => {
    loadResults();
  }, [scanId]);

  const loadResults = async () => {
    try {
      const [scanResponse, resultsResponse] = await Promise.all([
        window.electronAPI.scans.get(scanId),
        window.electronAPI.scans.getResults(scanId),
      ]);
      
      // Extract actual data from response objects
      if (scanResponse.success && scanResponse.scan) {
        setScan(scanResponse.scan);
      }
      
      if (resultsResponse.success && resultsResponse.results) {
        setResults(resultsResponse.results);
      }
      
      // Load project data for PDF export
      if (scanResponse?.scan?.projectId) {
        const projectResult = await window.electronAPI.projects.get(scanResponse.scan.projectId);
        if (projectResult.success) {
          setProject(projectResult.project);
        }
      }
    } catch (error) {
      console.error('Failed to load scan results:', error);
      toast({
        title: 'Error',
        description: 'Failed to load scan results',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = () => {
    if (!scan || !project) {
      toast({
        title: 'Export failed',
        description: 'Scan data not loaded',
        variant: 'destructive',
      });
      return;
    }

    try {
      const scanDate = typeof scan.createdAt === 'number'
        ? new Date(scan.createdAt * 1000)
        : new Date(scan.createdAt);
      
      const scanData = {
        projectName: project.name,
        domain: project.domain,
        scanDate: scanDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        overallScore: scan.overallScore || 0,
        results: results.map((r) => ({
          provider: r.provider,
          queryText: r.queryText,
          aiResponseRaw: r.aiResponseRaw,
          metrics: r.metricsJson ? JSON.parse(r.metricsJson) : null,
        })),
      };

      const averages = calculateAverages();
      exportScanToPDF(scanData, averages);

      toast({
        title: 'PDF Exported',
        description: 'Report downloaded successfully',
      });
    } catch (error) {
      console.error('PDF export failed:', error);
      toast({
        title: 'Export failed',
        description: 'Failed to generate PDF report',
        variant: 'destructive',
      });
    }
  };

  const getMetrics = (result: ScanResult): Metrics | null => {
    if (!result.metricsJson) return null;
    try {
      return JSON.parse(result.metricsJson);
    } catch {
      return null;
    }
  };

  const calculateAverages = () => {
    const metricsArray = results
      .map((r) => getMetrics(r))
      .filter((m): m is Metrics => m !== null);

    if (metricsArray.length === 0) {
      return {
        visibilityRate: 0,
        avgSentiment: 0,
        citationRate: 0,
        avgRecommendation: 0,
      };
    }

    return {
      visibilityRate: (metricsArray.filter((m) => m.is_visible).length / metricsArray.length) * 100,
      avgSentiment: metricsArray.reduce((sum, m) => sum + m.sentiment_score, 0) / metricsArray.length,
      citationRate: (metricsArray.filter((m) => m.citation_found).length / metricsArray.length) * 100,
      avgRecommendation: metricsArray.reduce((sum, m) => sum + m.recommendation_strength, 0) / metricsArray.length,
    };
  };

  const getSentimentColor = (score: number) => {
    if (score > 0.3) return 'text-green-500';
    if (score < -0.3) return 'text-red-500';
    return 'text-yellow-500';
  };

  const getSentimentLabel = (score: number) => {
    if (score > 0.3) return 'Positive';
    if (score < -0.3) return 'Negative';
    return 'Neutral';
  };

  if (loading) {
    return <LoadingState message="Loading scan results..." />;
  }

  if (!scan || results.length === 0) {
    return (
      <EmptyState
        icon="📊"
        title="No Results Found"
        description="This scan doesn't have any results yet."
        action={{ label: 'Go Back', onClick: onBack }}
      />
    );
  }

  const averages = calculateAverages();

  return (
    <TooltipProvider>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="border-b border-zinc-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" onClick={onBack} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Project
            </Button>
            <Button variant="outline" className="gap-2" onClick={handleExportPDF}>
              <Download className="w-4 h-4" />
              Export PDF
            </Button>
          </div>

          {scan && (
            <div>
              <h2 className="text-2xl font-semibold mb-2">
                Scan Results
              </h2>
              <div className="flex gap-4 text-sm text-zinc-400">
                <span>
                  {typeof scan.createdAt === 'number'
                    ? new Date(scan.createdAt * 1000).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : new Date(scan.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                </span>
                <span>•</span>
                <span>{results.length} responses</span>
              </div>
            </div>
          )}
        </div>

      {/* Overview Cards */}
      <div className="p-6 border-b border-zinc-800">
        <div className="grid grid-cols-5 gap-4">
          {/* Overall Score */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="bg-zinc-900 rounded-lg p-4 cursor-help">
                <div className="text-sm text-zinc-400 mb-2">Overall Score</div>
                <div className="text-3xl font-bold text-blue-500">
                  {scan?.overallScore || 0}
                  <span className="text-lg text-zinc-500">/100</span>
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs">Combined score across all metrics: visibility, sentiment, citations, and recommendation strength</p>
            </TooltipContent>
          </Tooltip>

          {/* Visibility Rate */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="bg-zinc-900 rounded-lg p-4 cursor-help">
                <div className="text-sm text-zinc-400 mb-2">Visibility Rate</div>
                <div className="text-3xl font-bold">
                  {averages.visibilityRate.toFixed(0)}
                  <span className="text-lg text-zinc-500">%</span>
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs">Percentage of AI responses that mentioned your brand</p>
            </TooltipContent>
          </Tooltip>

          {/* Avg Sentiment */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="bg-zinc-900 rounded-lg p-4 cursor-help">
                <div className="text-sm text-zinc-400 mb-2">Avg Sentiment</div>
                <div className={`text-2xl font-bold ${getSentimentColor(averages.avgSentiment)}`}>
                  {getSentimentLabel(averages.avgSentiment)}
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs">Average sentiment when brand is mentioned (negative, neutral, or positive tone)</p>
            </TooltipContent>
          </Tooltip>

          {/* Citation Rate */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="bg-zinc-900 rounded-lg p-4 cursor-help">
                <div className="text-sm text-zinc-400 mb-2">Citation Rate</div>
                <div className="text-3xl font-bold">
                  {averages.citationRate.toFixed(0)}
                  <span className="text-lg text-zinc-500">%</span>
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs">Percentage of responses that cited or linked to your brand</p>
            </TooltipContent>
          </Tooltip>

          {/* Avg Recommendation */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="bg-zinc-900 rounded-lg p-4 cursor-help">
                <div className="text-sm text-zinc-400 mb-2">Recommendation</div>
                <div className="text-3xl font-bold">
                  {averages.avgRecommendation.toFixed(0)}
                  <span className="text-lg text-zinc-500">/100</span>
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs">How strongly AI recommends your brand (0-100)</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Results List */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-4">
          {results.map((result) => {
            const metrics = getMetrics(result);
            return (
              <div key={result.id} className="bg-zinc-900 rounded-lg p-4">
                {/* Result Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-sm font-medium text-blue-400">{result.provider}</span>
                      {metrics && (
                        <>
                          {metrics.is_visible && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-xs px-2 py-1 bg-green-500/10 text-green-500 rounded cursor-help">
                                  Visible
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Your brand was mentioned in this response</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          {metrics.citation_found && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-xs px-2 py-1 bg-blue-500/10 text-blue-500 rounded cursor-help">
                                  Cited
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Your brand was cited or linked in the response</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          {metrics.ranking_position && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-xs px-2 py-1 bg-purple-500/10 text-purple-500 rounded cursor-help">
                                  #{metrics.ranking_position}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Position in which your brand was mentioned</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </>
                      )}
                    </div>
                    <div className="text-sm text-zinc-300 mb-3">{result.queryText}</div>
                  </div>
                  {metrics && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="text-right cursor-help">
                          <div className={`text-sm font-medium ${getSentimentColor(metrics.sentiment_score)}`}>
                            {getSentimentLabel(metrics.sentiment_score)}
                          </div>
                          <div className="text-xs text-zinc-500">
                            {metrics.recommendation_strength}/100
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="space-y-1">
                          <p><strong>Sentiment:</strong> {getSentimentLabel(metrics.sentiment_score)}</p>
                          <p><strong>Recommendation Strength:</strong> {metrics.recommendation_strength}/100</p>
                          <p className="text-xs text-zinc-400 mt-2">How strongly the AI recommends your brand</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>

                {/* AI Response */}
                <div className="bg-zinc-950 rounded p-3 text-sm text-zinc-300 leading-relaxed prose prose-invert prose-sm max-w-none [&_mark.brand-highlight]:bg-green-500/20 [&_mark.brand-highlight]:text-green-400 [&_mark.brand-highlight]:px-1 [&_mark.brand-highlight]:rounded [&_mark.keyword-highlight]:bg-orange-500/20 [&_mark.keyword-highlight]:text-orange-400 [&_mark.keyword-highlight]:px-1 [&_mark.keyword-highlight]:rounded">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw]}
                  >
                    {highlightAndRenderMarkdown(result.aiResponseRaw)}
                  </ReactMarkdown>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      </div>
    </TooltipProvider>
  );
}
