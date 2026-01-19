import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card } from './ui/card';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface Scan {
  id: string;
  createdAt: number;
  overallScore: number | null;
}

interface OverallScoreChartProps {
  scans: Scan[];
}

interface DayMetrics {
  overallScores: number[];
  visibilityRates: number[];
  sentiments: number[];
  citationRates: number[];
  recommendations: number[];
  date: string;
}

export function OverallScoreChart({ scans }: OverallScoreChartProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [enrichedData, setEnrichedData] = useState<any[]>([]);

  // Filter scans with scores
  const scansWithScores = scans.filter(s => s.overallScore !== null);

  if (scansWithScores.length === 0) {
    return null; // Don't show if no scans
  }

  useEffect(() => {
    const loadMetrics = async () => {
      try {
        // Load results for all scans
        const scanResults = await Promise.all(
          scansWithScores.map(async (scan) => {
            const result = await window.electronAPI.scans.getResults(scan.id);
            return {
              scan,
              results: result.success ? result.results : []
            };
          })
        );

        // Group by day and aggregate metrics
        const groupedByDay: Record<string, DayMetrics> = {};
        
        scanResults.forEach(({ scan, results }) => {
          const date = new Date(
            typeof scan.createdAt === 'number' ? scan.createdAt * 1000 : scan.createdAt
          );
          const dayKey = date.toISOString().split('T')[0];

          if (!groupedByDay[dayKey]) {
            groupedByDay[dayKey] = {
              overallScores: [],
              visibilityRates: [],
              sentiments: [],
              citationRates: [],
              recommendations: [],
              date: dayKey
            };
          }

          groupedByDay[dayKey].overallScores.push(scan.overallScore!);

          // Aggregate metrics from results
          if (results && results.length > 0) {
            const visibleCount = results.filter((r: any) => {
              const metrics = r.metricsJson ? JSON.parse(r.metricsJson) : null;
              return metrics?.is_visible;
            }).length;
            const visibilityRate = (visibleCount / results.length) * 100;
            groupedByDay[dayKey].visibilityRates.push(visibilityRate);

            const sentiments = results
              .map((r: any) => {
                const metrics = r.metricsJson ? JSON.parse(r.metricsJson) : null;
                return metrics?.sentiment_score || 0;
              })
              .filter((s: number) => s !== 0);
            if (sentiments.length > 0) {
              const avgSentiment = sentiments.reduce((sum: number, s: number) => sum + s, 0) / sentiments.length;
              // Normalize sentiment from [-1, 1] to [0, 100]
              const normalizedSentiment = (avgSentiment + 1) * 50;
              groupedByDay[dayKey].sentiments.push(normalizedSentiment);
            }

            const citedCount = results.filter((r: any) => {
              const metrics = r.metricsJson ? JSON.parse(r.metricsJson) : null;
              return metrics?.citation_found;
            }).length;
            const citationRate = (citedCount / results.length) * 100;
            groupedByDay[dayKey].citationRates.push(citationRate);

            const recommendations = results.map((r: any) => {
              const metrics = r.metricsJson ? JSON.parse(r.metricsJson) : null;
              return metrics?.recommendation_strength || 0;
            });
            if (recommendations.length > 0) {
              const avgRec = recommendations.reduce((sum: number, r: number) => sum + r, 0) / recommendations.length;
              groupedByDay[dayKey].recommendations.push(avgRec);
            }
          }
        });

        // Calculate daily averages
        const chartData = Object.entries(groupedByDay)
          .map(([date, data]) => ({
            date,
            overallScore: Math.round(
              data.overallScores.reduce((sum, s) => sum + s, 0) / data.overallScores.length
            ),
            visibilityRate: data.visibilityRates.length > 0
              ? Math.round(data.visibilityRates.reduce((sum, s) => sum + s, 0) / data.visibilityRates.length)
              : 0,
            sentiment: data.sentiments.length > 0
              ? Math.round(data.sentiments.reduce((sum, s) => sum + s, 0) / data.sentiments.length)
              : 50, // 50 = neutral (0.0 sentiment)
            citationRate: data.citationRates.length > 0
              ? Math.round(data.citationRates.reduce((sum, s) => sum + s, 0) / data.citationRates.length)
              : 0,
            recommendation: data.recommendations.length > 0
              ? Math.round(data.recommendations.reduce((sum, s) => sum + s, 0) / data.recommendations.length)
              : 0,
            count: data.overallScores.length,
          }))
          .sort((a, b) => a.date.localeCompare(b.date));

        setEnrichedData(chartData);
      } catch (error) {
        console.error('Failed to load metrics:', error);
      }
    };

    if (isExpanded && enrichedData.length === 0) {
      loadMetrics();
    }
  }, [isExpanded, scansWithScores]);

  // Simple data for collapsed view
  const groupedByDay = scansWithScores.reduce((acc, scan) => {
    const date = new Date(
      typeof scan.createdAt === 'number' ? scan.createdAt * 1000 : scan.createdAt
    );
    const dayKey = date.toISOString().split('T')[0];

    if (!acc[dayKey]) {
      acc[dayKey] = { scores: [], date: dayKey };
    }
    acc[dayKey].scores.push(scan.overallScore!);
    return acc;
  }, {} as Record<string, { scores: number[]; date: string }>);

  const chartData = Object.entries(groupedByDay)
    .map(([date, data]) => ({
      date,
      score: Math.round(data.scores.reduce((sum, s) => sum + s, 0) / data.scores.length),
      count: data.scores.length,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <Card className={`overflow-hidden transition-all duration-1000 ease-in-out ${isExpanded ? 'p-4' : 'px-4 pt-4 pb-1'}`}>
      <div 
        className="flex items-center justify-between mb-3 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h3 className="text-sm font-medium text-zinc-400">Overall Score Trend</h3>
        <button className="text-zinc-400 hover:text-zinc-300 transition-colors">
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      </div>

      <div 
        className="relative overflow-hidden"
        style={{
          transition: 'height 1s ease-in-out',
          height: isExpanded ? '480px' : '80px'
        }}
      >
        <div 
          className="absolute inset-0 transition-opacity duration-1000 ease-in-out"
          style={{ 
            opacity: !isExpanded ? 1 : 0,
            pointerEvents: !isExpanded ? 'auto' : 'none'
          }}
        >
          <ResponsiveContainer width="100%" height={80}>
            <LineChart data={chartData}>
              <Line 
                type="monotone" 
                dataKey="score" 
                stroke="#3b82f6" 
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div 
          className="absolute inset-0 transition-opacity duration-1000 ease-in-out"
          style={{ 
            opacity: isExpanded ? 1 : 0,
            pointerEvents: isExpanded ? 'auto' : 'none'
          }}
        >
          <div className="space-y-6">
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={enrichedData.length > 0 ? enrichedData : chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <XAxis 
                  dataKey="date" 
                  stroke="#71717a"
                  tick={{ fill: '#71717a', fontSize: 12 }}
                  tickFormatter={(date) => {
                    const d = new Date(date);
                    return `${d.getDate()}/${d.getMonth() + 1}`;
                  }}
                />
                <YAxis 
                  stroke="#71717a"
                  tick={{ fill: '#71717a', fontSize: 12 }}
                  domain={[0, 100]}
                  label={{ value: 'Score (0-100)', angle: -90, position: 'insideLeft', fill: '#71717a' }}
                />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: '#18181b',
                    border: '1px solid #3f3f46',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: '#a1a1aa' }}
                  labelFormatter={(date) => {
                    const d = new Date(date);
                    return d.toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    });
                  }}
                />
                <Legend 
                  wrapperStyle={{ paddingTop: '10px' }}
                  iconType="line"
                />
                <Line 
                  type="monotone" 
                  dataKey="overallScore"
                  name="Overall Score"
                  stroke="#3b82f6" 
                  strokeWidth={3}
                  dot={{ fill: '#3b82f6', r: 4 }}
                  activeDot={{ r: 6 }}
                />
                {enrichedData.length > 0 && (
                  <>
                    <Line 
                      type="monotone" 
                      dataKey="visibilityRate"
                      name="Visibility %"
                      stroke="#22c55e" 
                      strokeWidth={2}
                      dot={{ fill: '#22c55e', r: 3 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="sentiment"
                      name="Sentiment"
                      stroke="#f59e0b" 
                      strokeWidth={2}
                      dot={{ fill: '#f59e0b', r: 3 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="citationRate"
                      name="Citation %"
                      stroke="#8b5cf6" 
                      strokeWidth={2}
                      dot={{ fill: '#8b5cf6', r: 3 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="recommendation"
                      name="Recommendation"
                      stroke="#ec4899" 
                      strokeWidth={2}
                      dot={{ fill: '#ec4899', r: 3 }}
                    />
                  </>
                )}
              </LineChart>
            </ResponsiveContainer>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-zinc-900 rounded-lg p-4">
                <div className="text-sm text-zinc-400 mb-1">Latest Score</div>
                <div className="text-2xl font-bold text-blue-500">
                  {chartData[chartData.length - 1]?.score || 0}
                </div>
              </div>
              <div className="bg-zinc-900 rounded-lg p-4">
                <div className="text-sm text-zinc-400 mb-1">Average Score</div>
                <div className="text-2xl font-bold">
                  {Math.round(chartData.reduce((sum, d) => sum + d.score, 0) / chartData.length)}
                </div>
              </div>
              <div className="bg-zinc-900 rounded-lg p-4">
                <div className="text-sm text-zinc-400 mb-1">Total Scans</div>
                <div className="text-2xl font-bold">
                  {chartData.reduce((sum, d) => sum + d.count, 0)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
