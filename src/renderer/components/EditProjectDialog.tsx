import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useToast } from '../hooks/use-toast';

interface EditProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onProjectUpdated: () => void;
  onProjectDeleted: () => void;
}

export function EditProjectDialog({ open, onOpenChange, projectId, onProjectUpdated, onProjectDeleted }: EditProjectDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    domain: '',
    brandVariations: '',
    targetKeywords: '',
    language: 'en',
  });
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && projectId) {
      loadProject();
    }
  }, [open, projectId]);

  const loadProject = async () => {
    try {
      const result = await window.electronAPI.projects.get(projectId);
      if (result.success && result.project) {
        const p = result.project;
        setFormData({
          name: p.name,
          domain: p.domain,
          brandVariations: JSON.parse(p.brandVariations || '[]').join(', '),
          targetKeywords: JSON.parse(p.targetKeywords || '[]').join(', '),
          language: p.language || 'en',
        });
      }
    } catch (error) {
      console.error('Failed to load project:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.domain) {
      toast({
        title: 'Error',
        description: 'Please fill in project name and domain',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const result = await window.electronAPI.projects.update(projectId, {
        name: formData.name,
        domain: formData.domain,
        brandVariations: JSON.stringify(
          formData.brandVariations
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        ),
        targetKeywords: JSON.stringify(
          formData.targetKeywords
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        ),
        language: formData.language, // ← FIXED: Send language!
      });

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Project updated successfully',
        });
        
        onOpenChange(false);
        onProjectUpdated();
      } else {
        throw new Error(result.error);
      }
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

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      return;
    }

    setDeleting(true);

    try {
      const result = await window.electronAPI.projects.delete(projectId);

      if (result.success) {
        toast({
          title: 'Deleted',
          description: 'Project deleted successfully',
        });
        
        onOpenChange(false);
        onProjectDeleted();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: String(error),
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Project</DialogTitle>
          <DialogDescription>
            Update project details or delete the project
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Project Name</Label>
              <Input
                id="edit-name"
                placeholder="My Awesome Product"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-domain">Domain</Label>
              <Input
                id="edit-domain"
                placeholder="example.com"
                value={formData.domain}
                onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-brands">Brand Variations</Label>
              <Input
                id="edit-brands"
                placeholder="Brand Name, BrandName, Brand (comma-separated)"
                value={formData.brandVariations}
                onChange={(e) => setFormData({ ...formData, brandVariations: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-keywords">Target Keywords</Label>
              <Input
                id="edit-keywords"
                placeholder="keyword1, keyword2, keyword3"
                value={formData.targetKeywords}
                onChange={(e) => setFormData({ ...formData, targetKeywords: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-language">Language / Market</Label>
              <Select
                value={formData.language}
                onValueChange={(value) => setFormData({ ...formData, language: value })}
              >
                <SelectTrigger id="edit-language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cs">🇨🇿 Czech</SelectItem>
                  <SelectItem value="sk">🇸🇰 Slovak</SelectItem>
                  <SelectItem value="en">🇬🇧 English</SelectItem>
                  <SelectItem value="de">🇩🇪 German</SelectItem>
                  <SelectItem value="other">🌍 Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="flex justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={handleDelete}
              disabled={deleting || loading}
              className="text-red-500 hover:text-red-400 hover:bg-red-950/50"
            >
              {deleting ? 'Deleting...' : 'Delete Project'}
            </Button>
            
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading || deleting}>
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
