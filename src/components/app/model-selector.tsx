import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FaSync, FaSpinner } from 'react-icons/fa';
import { fetchAvailableModels, type ModelInfo } from '@/lib/model-fetcher';
import type { ApiProvider } from '@/lib/types';
import { toast } from 'sonner';

interface ModelSelectorProps {
  provider: ApiProvider;
  apiKey: string;
  baseUrl?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function ModelSelector({
  provider,
  apiKey,
  baseUrl,
  value,
  onChange,
  placeholder = 'Select a model',
}: ModelSelectorProps) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useCustomInput, setUseCustomInput] = useState(false);

  // Fetch models when provider or API key changes
  useEffect(() => {
    if (provider && apiKey) {
      loadModels();
    }
  }, [provider, apiKey, baseUrl]);

  const loadModels = async () => {
    if (!apiKey && provider !== 'lmstudio' && provider !== 'ollama') {
      setError('API key required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const fetchedModels = await fetchAvailableModels(provider, apiKey, baseUrl);
      setModels(fetchedModels);
      setUseCustomInput(false);
    } catch (err) {
      console.error('Failed to fetch models:', err);
      setError('Failed to fetch models');
      toast.error('Failed to fetch models. You can type the model name manually.');
      setUseCustomInput(true);
    } finally {
      setLoading(false);
    }
  };

  // If there's an error or user wants custom input, show text input
  if (useCustomInput || error) {
    return (
      <div className="space-y-2">
        <div className="flex gap-2">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="flex-1"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              setUseCustomInput(false);
              loadModels();
            }}
            disabled={loading}
          >
            <FaSync size={14} />
          </Button>
        </div>
        {error && (
          <p className="text-xs text-muted-foreground">
            Enter model name manually or fix connection to fetch models
          </p>
        )}
      </div>
    );
  }

  // If loading, show loading state
  if (loading) {
    return (
      <div className="flex items-center gap-2 p-2 border rounded-md">
        <FaSpinner className="animate-spin text-muted-foreground" size={14} />
        <span className="text-sm text-muted-foreground">Fetching available models...</span>
      </div>
    );
  }

  // If no models available, fall back to text input
  if (models.length === 0) {
    return (
      <div className="space-y-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
        <p className="text-xs text-muted-foreground">
          No models found. Enter model name manually.
        </p>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="flex-1">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {models.map((model) => (
            <SelectItem key={model.id} value={model.id}>
              <div className="flex flex-col">
                <span>{model.name}</span>
                {model.description && (
                  <span className="text-xs text-muted-foreground">{model.description}</span>
                )}
              </div>
            </SelectItem>
          ))}
          <SelectItem value="__custom__">
            <span className="text-muted-foreground italic">Enter custom model...</span>
          </SelectItem>
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        size="icon"
        onClick={loadModels}
        disabled={loading}
        title="Refresh models"
      >
        <FaSync size={14} />
      </Button>
    </div>
  );
}
