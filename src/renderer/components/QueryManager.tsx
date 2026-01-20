import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Checkbox } from './ui/checkbox';
import { useToast } from '../hooks/use-toast';
import { Sparkles, Plus, Trash2, Edit2, ChevronDown } from 'lucide-react';

interface Query {
  id: string;
  queryText: string;
  type: string;
  isActive: boolean;
}

interface QueryManagerProps {
  projectId: string;
  brandVariations: string[];
  domain: string;
  keywords: string[];
  language: string;
}

export function QueryManager({ projectId, brandVariations, domain, keywords, language }: QueryManagerProps) {
  const [queries, setQueries] = useState<Query[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingQuery, setEditingQuery] = useState<Query | null>(null);
  const [formData, setFormData] = useState({ queryText: '', type: 'informational' });
  const [includeBrandInQueries, setIncludeBrandInQueries] = useState(false);
  const [isQueriesExpanded, setIsQueriesExpanded] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadQueries();
  }, [projectId]);

  // Auto-expand if no queries
  useEffect(() => {
    if (queries.length === 0) {
      setIsQueriesExpanded(true);
    }
  }, [queries]);

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

  const handleGenerate = async () => {
    // Check if OpenAI is configured
    const settingsResult = await window.electronAPI.settings.get('openai');
    if (!settingsResult.success || !settingsResult.isConfigured) {
      toast({
        title: 'OpenAI Not Configured',
        description: 'Please configure your OpenAI API key in Settings first',
        variant: 'destructive',
      });
      return;
    }

    setGenerating(true);

    try {
      const result = await window.electronAPI.queries.generate(
        brandVariations,
        domain,
        keywords,
        language,
        includeBrandInQueries
      );

      if (result.success && result.queries) {
        // Save generated queries to database with their types
        for (const query of result.queries) {
          await window.electronAPI.queries.create({
            projectId,
            queryText: typeof query === 'string' ? query : query.queryText,
            type: typeof query === 'string' ? 'informational' : query.type,
            isActive: true,
          });
        }

        toast({
          title: 'Success',
          description: `Generated ${result.queries.length} queries with different types`,
        });

        loadQueries();
      } else {
        throw new Error(result.error || 'Failed to generate queries');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: String(error),
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!formData.queryText) {
      toast({
        title: 'Error',
        description: 'Please enter a query',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      if (editingQuery) {
        const result = await window.electronAPI.queries.update(editingQuery.id, {
          queryText: formData.queryText,
          type: formData.type,
        });

        if (result.success) {
          toast({ title: 'Success', description: 'Query updated' });
        }
      } else {
        const result = await window.electronAPI.queries.create({
          projectId,
          queryText: formData.queryText,
          type: formData.type,
          isActive: true,
        });

        if (result.success) {
          toast({ title: 'Success', description: 'Query added' });
        }
      }

      setFormData({ queryText: '', type: 'informational' });
      setEditingQuery(null);
      setShowAddDialog(false);
      loadQueries();
    } catch (error) {
      toast({
        title: 'Error',
        description: String(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this query?')) return;

    try {
      const result = await window.electronAPI.queries.delete(id);
      if (result.success) {
        toast({ title: 'Deleted', description: 'Query deleted' });
        loadQueries();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: String(error),
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (query: Query) => {
    setEditingQuery(query);
    setFormData({ queryText: query.queryText, type: query.type });
    setShowAddDialog(true);
  };

  const handleToggle = async (query: Query) => {
    try {
      await window.electronAPI.queries.update(query.id, {
        isActive: !query.isActive,
      });
      loadQueries();
    } catch (error) {
      console.error('Failed to toggle query:', error);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div 
                className="flex items-center gap-2 cursor-pointer flex-1"
                onClick={() => setIsQueriesExpanded(!isQueriesExpanded)}
              >
                <div className="flex-1">
                  <CardTitle>Test Queries ({queries.length})</CardTitle>
                  <CardDescription>
                    Questions that will be asked to AI models
                  </CardDescription>
                </div>
              </div>
              <ChevronDown 
                className={`w-5 h-5 transition-transform duration-200 cursor-pointer flex-shrink-0 ${isQueriesExpanded ? '' : '-rotate-90'}`}
                onClick={() => setIsQueriesExpanded(!isQueriesExpanded)}
              />
            </div>
            
            {isQueriesExpanded && (
              <div className="flex gap-4 items-center">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="includeBrand"
                    checked={includeBrandInQueries}
                    onCheckedChange={(checked) => setIncludeBrandInQueries(checked === true)}
                  />
                  <Label htmlFor="includeBrand" className="text-sm cursor-pointer">
                    Include brand in queries
                    <span className="block text-xs text-zinc-500">
                      {includeBrandInQueries ? 'Sentiment analysis' : 'Brand awareness'}
                    </span>
                  </Label>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    onClick={handleGenerate}
                    disabled={generating}
                    className="gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    {generating ? 'Generating...' : 'AI Generate'}
                  </Button>
                  <Button onClick={() => {
                    setEditingQuery(null);
                    setFormData({ queryText: '', type: 'informational' });
                    setShowAddDialog(true);
                  }} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Add Query
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardHeader>
        {isQueriesExpanded && (
          <CardContent>
            {queries.length === 0 ? (
              <div className="text-center py-12 text-zinc-500">
                <p className="text-sm">No queries yet</p>
                <p className="text-xs mt-1">Add queries manually or use AI generation</p>
              </div>
            ) : (
              <div className="space-y-2">
                {queries.map((query) => (
                  <div
                    key={query.id}
                    className="flex items-center gap-3 p-3 bg-zinc-800 hover:bg-zinc-750"
                  >
                    <input
                      type="checkbox"
                      checked={query.isActive}
                      onChange={() => handleToggle(query)}
                      className="w-4 h-4"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{query.queryText}</p>
                      <p className="text-xs text-zinc-500 mt-0.5 capitalize">{query.type}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEdit(query)}
                      >
                        <Edit2 className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-400"
                        onClick={() => handleDelete(query.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      <Dialog open={showAddDialog} onOpenChange={(open) => {
        setShowAddDialog(open);
        if (!open) {
          setEditingQuery(null);
          setFormData({ queryText: '', type: 'informational' });
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingQuery ? 'Edit Query' : 'Add Query'}</DialogTitle>
            <DialogDescription>
              Create a test query that will be sent to AI models
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="query">Query Text</Label>
              <Input
                id="query"
                placeholder="What are the best tools for..."
                value={formData.queryText}
                onChange={(e) => setFormData({ ...formData, queryText: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Query Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="informational">Informational</SelectItem>
                  <SelectItem value="transactional">Transactional</SelectItem>
                  <SelectItem value="comparison">Comparison</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-zinc-500">
                Informational: "What is...", Transactional: "Buy...", Comparison: "X vs Y"
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? 'Saving...' : editingQuery ? 'Update' : 'Add Query'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
