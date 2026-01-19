import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { useToast } from '../hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface ProviderConfig {
  id: string;
  name: string;
  models: string[];
  defaultModel: string;
  keyPlaceholder: string;
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    models: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o1-mini'],
    defaultModel: 'gpt-4o',
    keyPlaceholder: 'sk-...',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
    defaultModel: 'claude-3-5-sonnet-20241022',
    keyPlaceholder: 'sk-ant-...',
  },
  {
    id: 'google',
    name: 'Google AI',
    models: ['gemini-2.0-flash-exp', 'gemini-2.0-flash-thinking-exp-01-21', 'gemini-1.5-pro-002', 'gemini-1.5-flash-002'],
    defaultModel: 'gemini-2.0-flash-exp',
    keyPlaceholder: 'AIza...',
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    models: ['sonar-pro', 'sonar', 'sonar-reasoning'],
    defaultModel: 'sonar-pro',
    keyPlaceholder: 'pplx-...',
  },
];

export function Settings() {
  const [configs, setConfigs] = useState<Record<string, { apiKey: string; model: string; isConfigured: boolean }>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const result = await window.electronAPI.settings.getAll();
      if (result.success && result.settings) {
        const configMap: Record<string, any> = {};
        result.settings.forEach((s: any) => {
          configMap[s.provider] = {
            apiKey: '',
            model: s.model,
            isConfigured: s.isConfigured,
          };
        });
        setConfigs(configMap);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const handleSave = async (providerId: string) => {
    const config = configs[providerId];
    if (!config?.apiKey) {
      toast({
        title: 'Error',
        description: 'Please enter an API key',
        variant: 'destructive',
      });
      return;
    }

    setLoading({ ...loading, [providerId]: true });

    try {
      const result = await window.electronAPI.settings.save(
        providerId,
        config.apiKey,
        config.model || PROVIDERS.find((p) => p.id === providerId)!.defaultModel
      );

      if (result.success) {
        toast({
          title: 'Saved',
          description: `${PROVIDERS.find((p) => p.id === providerId)?.name} API key saved successfully`,
        });
        
        setConfigs({
          ...configs,
          [providerId]: { ...config, apiKey: '', isConfigured: true },
        });
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
      setLoading({ ...loading, [providerId]: false });
    }
  };

  const handleVerify = async (providerId: string) => {
    setLoading({ ...loading, [providerId]: true });

    try {
      const result = await window.electronAPI.settings.verify(providerId);

      if (result.success && result.isValid) {
        toast({
          title: 'Verified',
          description: 'API key is valid',
        });
      } else {
        toast({
          title: 'Invalid',
          description: 'API key verification failed',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: String(error),
        variant: 'destructive',
      });
    } finally {
      setLoading({ ...loading, [providerId]: false });
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-light tracking-tight mb-2">Settings</h1>
        <p className="text-sm text-zinc-500">Configure API keys for LLM providers</p>
      </div>

      <Tabs defaultValue={PROVIDERS[0].id} className="w-full">
        <TabsList className="w-full justify-start mb-6">
          {PROVIDERS.map((provider) => (
            <TabsTrigger key={provider.id} value={provider.id} className="relative">
              {provider.name}
              {configs[provider.id]?.isConfigured && (
                <span className="ml-2 w-1.5 h-1.5 bg-green-500 rounded-full" />
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {PROVIDERS.map((provider) => (
          <TabsContent key={provider.id} value={provider.id}>
            <Card>
              <CardHeader>
                <CardTitle>{provider.name} Configuration</CardTitle>
                <CardDescription>
                  {configs[provider.id]?.isConfigured
                    ? 'API key is configured. Enter a new key to update.'
                    : 'Enter your API key to get started.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor={`${provider.id}-key`}>API Key</Label>
                  <Input
                    id={`${provider.id}-key`}
                    type="password"
                    placeholder={provider.keyPlaceholder}
                    value={configs[provider.id]?.apiKey || ''}
                    onChange={(e) =>
                      setConfigs({
                        ...configs,
                        [provider.id]: {
                          ...configs[provider.id],
                          apiKey: e.target.value,
                        },
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`${provider.id}-model`}>Model</Label>
                  <Select
                    value={configs[provider.id]?.model || provider.defaultModel}
                    onValueChange={(value) =>
                      setConfigs({
                        ...configs,
                        [provider.id]: {
                          ...configs[provider.id],
                          model: value,
                        },
                      })
                    }
                  >
                    <SelectTrigger id={`${provider.id}-model`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {provider.models.map((model) => (
                        <SelectItem key={model} value={model}>
                          {model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={() => handleSave(provider.id)}
                    disabled={loading[provider.id]}
                  >
                    {loading[provider.id] ? 'Saving...' : 'Save'}
                  </Button>
                  
                  {configs[provider.id]?.isConfigured && (
                    <Button
                      variant="ghost"
                      onClick={() => handleVerify(provider.id)}
                      disabled={loading[provider.id]}
                    >
                      Verify
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
