import { useState, useEffect } from 'react';
import { Toaster } from './components/ui/toaster';
import { Sidebar } from './components/Sidebar';
import { Settings } from './components/Settings';
import { ProjectView } from './components/ProjectView';
import { ScanResults } from './components/ScanResults';
import { NewProjectDialog } from './components/NewProjectDialog';
import { useToast } from './hooks/use-toast';

function App() {
  const [currentView, setCurrentView] = useState<'settings' | 'project' | 'scan-results'>('settings');
  const [currentProjectId, setCurrentProjectId] = useState<string | undefined>();
  const [currentScanId, setCurrentScanId] = useState<string | undefined>();
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Test IPC connection
    if (window.electronAPI) {
      window.electronAPI.ping().then(() => {
        toast({
          title: 'System Ready',
          description: 'Application initialized successfully',
        });
      });
    }
  }, [toast]);

  const handleViewChange = (view: 'settings' | 'project' | 'scan-results', projectId?: string) => {
    setCurrentView(view);
    setCurrentProjectId(projectId);
  };

  const handleProjectCreated = async () => {
    // Force sidebar to refresh by toggling a refresh key
    setCurrentView('settings');
    
    // Load the new project list and switch to the newly created project
    const result = await window.electronAPI.projects.getAll();
    if (result.success && result.projects && result.projects.length > 0) {
      const latestProject = result.projects[0]; // Assuming newest first
      setCurrentView('project');
      setCurrentProjectId(latestProject.id);
    }
  };

  const handleViewScanResults = (scanId: string) => {
    setCurrentScanId(scanId);
    setCurrentView('scan-results');
  };

  const handleBackToProject = () => {
    setCurrentScanId(undefined);
    setCurrentView('project');
  };

  return (
    <>
      <div className="h-screen bg-zinc-950 text-zinc-100 flex overflow-hidden">
        <Sidebar
          currentView={currentView}
          currentProjectId={currentProjectId}
          onViewChange={handleViewChange}
          onNewProject={() => setShowNewProjectDialog(true)}
        />
        
        <div className="flex-1 overflow-y-auto">
          {currentView === 'settings' && <Settings />}
          {currentView === 'project' && currentProjectId && (
            <ProjectView
              projectId={currentProjectId}
              onProjectDeleted={() => {
                setCurrentView('settings');
                setCurrentProjectId(undefined);
              }}
              onViewScanResults={handleViewScanResults}
            />
          )}
          {currentView === 'scan-results' && currentScanId && (
            <ScanResults scanId={currentScanId} onBack={handleBackToProject} />
          )}
        </div>
      </div>

      <NewProjectDialog
        open={showNewProjectDialog}
        onOpenChange={setShowNewProjectDialog}
        onProjectCreated={handleProjectCreated}
      />

      <Toaster />
    </>
  );
}

export default App;
