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
    models: [
      'gpt-5',           // ✅ GPT-5 (nejnovější)
      'gpt-5-mini',      // GPT-5 Mini
      'gpt-5-nano',      // GPT-5 Nano (nejrychlejší)
      'gpt-4o',          // GPT-4o (starší, stabilní)
      'o1-preview',      // o1 Preview
    ],
    defaultModel: 'gpt-5',
    keyPlaceholder: 'sk-...',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    models: [
      'claude-sonnet-4-5-20250929',  // ✅ Claude 4.5 Sonnet (nejnovější!)
      'claude-opus-4-20250514',      // Claude 4 Opus
      'claude-sonnet-4-20250514',    // Claude 4 Sonnet
    ],
    defaultModel: 'claude-sonnet-4-5-20250929',
    keyPlaceholder: 'sk-ant-...',
  },
  {
    id: 'google',
    name: 'Google AI',
    models: [
      'gemini-3-pro-preview',      // ✅ Gemini 3 Pro (nejnovější)
      'gemini-3-flash-preview',    // Gemini 3 Flash (rychlý)
      'gemini-2.5-flash',          // Gemini 2.5 Flash
      'gemini-2.5-flash-lite',     // Gemini 2.5 Flash Lite (nejrychlejší)
    ],
    defaultModel: 'gemini-3-pro-preview',
    keyPlaceholder: 'AIza...',
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    models: ['sonar-pro', 'sonar-reasoning', 'sonar'],
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
    
    // If no API key AND not already configured, show error
    if (!config?.apiKey && !config?.isConfigured) {
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
        config.apiKey || '', // empty string = keep existing key
        config.model || PROVIDERS.find((p) => p.id === providerId)!.defaultModel
      );

      if (result.success) {
        const actionText = config.apiKey ? 'API key saved' : 'Settings updated';
        toast({
          title: 'Saved',
          description: `${PROVIDERS.find((p) => p.id === providerId)?.name} ${actionText} successfully`,
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
