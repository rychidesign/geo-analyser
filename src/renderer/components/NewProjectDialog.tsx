import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useToast } from '../hooks/use-toast';

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectCreated: () => void;
}

export function NewProjectDialog({ open, onOpenChange, onProjectCreated }: NewProjectDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    domain: '',
    brandVariations: '',
    targetKeywords: '',
    language: 'en',
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

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
      const result = await window.electronAPI.projects.create({
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
          description: 'Project created successfully',
        });
        
        setFormData({ name: '', domain: '', brandVariations: '', targetKeywords: '', language: 'en' });
        onOpenChange(false);
        onProjectCreated();
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
          <DialogDescription>
            Create a new GEO tracking project for your website
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Project Name</Label>
              <Input
                id="name"
                placeholder="My Awesome Product"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="domain">Domain</Label>
              <Input
                id="domain"
                placeholder="example.com"
                value={formData.domain}
                onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="brands">Brand Variations</Label>
              <Input
                id="brands"
                placeholder="Brand Name, BrandName, Brand (comma-separated)"
                value={formData.brandVariations}
                onChange={(e) => setFormData({ ...formData, brandVariations: e.target.value })}
              />
              <p className="text-xs text-zinc-500">
                Different ways your brand might appear in AI responses
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="keywords">Target Keywords</Label>
              <Input
                id="keywords"
                placeholder="keyword1, keyword2, keyword3"
                value={formData.targetKeywords}
                onChange={(e) => setFormData({ ...formData, targetKeywords: e.target.value })}
              />
              <p className="text-xs text-zinc-500">
                Keywords to track in AI responses
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="language">Language / Market</Label>
              <Select
                value={formData.language}
                onValueChange={(value) => setFormData({ ...formData, language: value })}
              >
                <SelectTrigger id="language">
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
              <p className="text-xs text-zinc-500">
                Language for AI-generated queries
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
