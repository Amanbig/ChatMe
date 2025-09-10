import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import SpeechSettings from "@/components/app/speech-settings";
import { 
    FaRobot, 
    FaGoogle, 
    FaServer, 
    FaCog, 
    FaCode,
    FaTrash,
    FaEdit,
    FaCheck,
    FaSpinner,
    FaPlug
} from "react-icons/fa";
import {
    getApiConfigs,
    createApiConfig,
    updateApiConfig,
    deleteApiConfig,
} from "@/lib/api";
import type { ApiConfig, ApiProvider } from "@/lib/types";

interface ProviderTemplate {
    id: ApiProvider;
    name: string;
    icon: React.ReactNode;
    description: string;
    defaultUrl?: string;
    defaultModels: string[];
    popular?: boolean;
}

const providerTemplates: ProviderTemplate[] = [
    {
        id: "openai",
        name: "OpenAI",
        icon: <FaRobot className="text-green-600" />,
        description: "GPT-4, GPT-3.5 and other OpenAI models",
        defaultUrl: "https://api.openai.com/v1/chat/completions",
        defaultModels: ["gpt-4", "gpt-4-turbo", "gpt-3.5-turbo"],
        popular: true
    },
    {
        id: "google",
        name: "Google Gemini", 
        icon: <FaGoogle className="text-blue-600" />,
        description: "Google's Gemini models (supports both original and OpenAI-compatible APIs)",
        defaultUrl: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        defaultModels: ["gemini-pro", "gemini-1.5-flash", "gemini-1.5-pro"],
        popular: true
    },
    {
        id: "anthropic",
        name: "Anthropic Claude",
        icon: <FaCode className="text-red-600" />,
        description: "Claude 3 and other Anthropic models",
        defaultUrl: "https://api.anthropic.com/v1/messages",
        defaultModels: ["claude-3-opus-20240229", "claude-3-sonnet-20240229", "claude-3-haiku-20240307"]
    },
    {
        id: "ollama",
        name: "Ollama",
        icon: <FaCog className="text-gray-600" />,
        description: "Local models via Ollama",
        defaultUrl: "http://localhost:11434",
        defaultModels: ["llama2", "codellama", "mistral", "neural-chat"]
    },
    {
        id: "custom",
        name: "Custom API",
        icon: <FaServer className="text-purple-600" />,
        description: "OpenAI-compatible APIs (Mistral, Groq, Together AI, etc.)",
        defaultModels: ["mistral-large", "mixtral-8x7b", "custom-model"]
    }
];

export default function SettingsPage() {
    const [configs, setConfigs] = useState<ApiConfig[]>([]);
    const [selectedProvider, setSelectedProvider] = useState<ApiProvider | null>(null);
    const [editingConfig, setEditingConfig] = useState<ApiConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    
    // Speech settings state
    const [speechEnabled, setSpeechEnabled] = useState(() => {
        const saved = localStorage.getItem('speechEnabled');
        return saved ? JSON.parse(saved) : true;
    });
    const [autoSpeak, setAutoSpeak] = useState(() => {
        const saved = localStorage.getItem('autoSpeak');
        return saved ? JSON.parse(saved) : false;
    });
    
    const [formData, setFormData] = useState({
        name: "",
        api_key: "",
        base_url: "",
        model: "",
        temperature: 0.7,
        max_tokens: null as number | null,
        is_default: false,
    });

    useEffect(() => {
        loadConfigs();
    }, []);

    const loadConfigs = async () => {
        try {
            setLoading(true);
            const fetchedConfigs = await getApiConfigs();
            setConfigs(fetchedConfigs);
        } catch (error) {
            console.error('Failed to load API configs:', error);
            toast.error('Failed to load configurations. Please refresh the page.');
        } finally {
            setLoading(false);
        }
    };

    const handleProviderSelect = (providerId: ApiProvider) => {
        const template = providerTemplates.find(p => p.id === providerId);
        if (template) {
            setSelectedProvider(providerId);
            setEditingConfig(null);
            setFormData({
                name: `${template.name} Configuration`,
                api_key: "",
                base_url: template.defaultUrl || "",
                model: template.defaultModels[0] || "",
                temperature: 0.7,
                max_tokens: null,
                is_default: configs.length === 0, // Make first config default
            });
        }
    };

    const handleEditConfig = (config: ApiConfig) => {
        setEditingConfig(config);
        setSelectedProvider(config.provider);
        setFormData({
            name: config.name,
            api_key: config.api_key,
            base_url: config.base_url || "",
            model: config.model,
            temperature: config.temperature,
            max_tokens: config.max_tokens,
            is_default: config.is_default,
        });
    };

    const handleInputChange = (field: string, value: any) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleSave = async () => {
        if (!selectedProvider) return;

        // Validation
        if (!formData.name.trim()) {
            toast.error('Please enter a configuration name');
            return;
        }
        if (!formData.model.trim()) {
            toast.error('Please enter a model name');
            return;
        }
        if (selectedProvider !== 'ollama' && !formData.api_key.trim()) {
            toast.error('Please enter an API key');
            return;
        }

        try {
            setSaving(true);
            const request = {
                name: formData.name,
                provider: selectedProvider,
                api_key: formData.api_key,
                base_url: formData.base_url || null,
                model: formData.model,
                temperature: formData.temperature,
                max_tokens: formData.max_tokens,
                is_default: formData.is_default,
            };

            if (editingConfig) {
                await updateApiConfig(editingConfig.id, request);
                toast.success('Configuration updated successfully!');
            } else {
                await createApiConfig(request);
                toast.success('Configuration created successfully!');
            }

            await loadConfigs();
            handleCancel();
        } catch (error) {
            console.error('Failed to save configuration:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            toast.error(`Failed to save configuration: ${errorMessage}`);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (configId: string) => {
        try {
            await deleteApiConfig(configId);
            await loadConfigs();
            toast.success('Configuration deleted successfully');
        } catch (error) {
            console.error('Failed to delete configuration:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            
            if (errorMessage.includes('last API configuration')) {
                toast.error('Cannot delete the last configuration. You must have at least one configuration.');
            } else if (errorMessage.includes('being used by chats')) {
                toast.error('Cannot delete this configuration because it is being used by existing chats.');
            } else {
                toast.error(`Failed to delete configuration: ${errorMessage}`);
            }
        }
    };

    const handleTestConnection = async () => {
        if (!selectedProvider || (!formData.api_key.trim() && selectedProvider !== 'ollama') || !formData.model.trim()) {
            toast.error('Please fill in the required fields before testing');
            return;
        }

        if (!formData.base_url.trim()) {
            toast.error('Please enter an API URL before testing');
            return;
        }

        try {
            setTesting(true);
            
            // For different providers, we need different test approaches
            let testUrl = formData.base_url;
            let testBody: any = {};
            let headers: any = {
                'Content-Type': 'application/json',
            };

            // Configure test based on provider
            switch (selectedProvider) {
                case 'openai':
                    testBody = {
                        model: formData.model,
                        messages: [{ role: 'user', content: 'Hi' }],
                        max_tokens: 1,
                    };
                    headers['Authorization'] = `Bearer ${formData.api_key}`;
                    break;
                
                case 'google':
                    // Google Gemini has different endpoint structure
                    testUrl = `${formData.base_url}/models/${formData.model}:generateContent`;
                    testBody = {
                        contents: [{ parts: [{ text: 'Hi' }] }],
                        generationConfig: { maxOutputTokens: 1 }
                    };
                    headers['Authorization'] = `Bearer ${formData.api_key}`;
                    break;
                
                case 'anthropic':
                    testBody = {
                        model: formData.model,
                        max_tokens: 1,
                        messages: [{ role: 'user', content: 'Hi' }]
                    };
                    headers['Authorization'] = `Bearer ${formData.api_key}`;
                    headers['anthropic-version'] = '2023-06-01';
                    break;
                
                case 'ollama':
                    testUrl = `${formData.base_url}/api/generate`;
                    testBody = {
                        model: formData.model,
                        prompt: 'Hi',
                        stream: false
                    };
                    break;
                
                default:
                    testBody = {
                        model: formData.model,
                        messages: [{ role: 'user', content: 'Hi' }],
                        max_tokens: 1,
                    };
                    if (formData.api_key) {
                        headers['Authorization'] = `Bearer ${formData.api_key}`;
                    }
            }

            const testPromise = fetch(testUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify(testBody),
            });

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Connection timeout after 10 seconds')), 10000)
            );

            const response = await Promise.race([testPromise, timeoutPromise]) as Response;
            
            if (response.ok) {
                toast.success('✅ Connection successful! Your configuration is working correctly.');
            } else if (response.status === 401 || response.status === 403) {
                toast.warning('🔑 API endpoint reached, but authentication failed. Please check your API key.');
            } else if (response.status === 404) {
                toast.warning('❓ API endpoint not found. Please check your API URL and model name.');
            } else {
                toast.warning(`⚠️ API responded with status ${response.status}. Your configuration may need adjustments.`);
            }
        } catch (error: any) {
            console.error('Connection test failed:', error);
            
            // Handle specific error types
            if (error.message?.includes('CORS') || error.message?.includes('Failed to fetch')) {
                toast.info('ℹ️ CORS blocked (this is normal). Your configuration will work in the actual chat - browsers block direct API calls for security.');
            } else if (error.message?.includes('timeout')) {
                toast.error('⏱️ Connection timeout. Please check your network connection and API URL.');
            } else if (error.message?.includes('NetworkError')) {
                toast.error('🌐 Network error. Please check your internet connection.');
            } else {
                toast.error(`❌ Connection test failed: ${error.message || 'Unknown error'}`);
            }
        } finally {
            setTesting(false);
        }
    };

    const handleCancel = () => {
        setSelectedProvider(null);
        setEditingConfig(null);
        setFormData({
            name: "",
            api_key: "",
            base_url: "",
            model: "",
            temperature: 0.7,
            max_tokens: null,
            is_default: false,
        });
    };

    const handleSpeechEnabledChange = (enabled: boolean) => {
        setSpeechEnabled(enabled);
        localStorage.setItem('speechEnabled', JSON.stringify(enabled));
    };

    const handleAutoSpeakChange = (enabled: boolean) => {
        setAutoSpeak(enabled);
        localStorage.setItem('autoSpeak', JSON.stringify(enabled));
    };

    const selectedTemplate = selectedProvider ? providerTemplates.find(p => p.id === selectedProvider) : null;

    return (
        <div className="h-full flex flex-col overflow-hidden">
            <ScrollArea className="flex-1 h-0">
                <div className="p-6 min-h-full">
                    <div className="max-w-6xl mx-auto space-y-6 pb-6">
                        {/* Header */}
                        <div>
                            <h1 className="text-3xl font-bold text-foreground mb-2">Settings</h1>
                            <p className="text-muted-foreground">Configure your AI providers and preferences</p>
                        </div>

                        {/* Speech Settings */}
                        <SpeechSettings
                            speechEnabled={speechEnabled}
                            onSpeechEnabledChange={handleSpeechEnabledChange}
                            autoSpeak={autoSpeak}
                            onAutoSpeakChange={handleAutoSpeakChange}
                        />

                        <Separator />

                {/* Existing Configurations */}
                {!loading && configs.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Your Configurations</CardTitle>
                            <CardDescription>Manage your existing AI provider configurations</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {configs.map((config) => (
                                <div
                                    key={config.id}
                                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        {providerTemplates.find(p => p.id === config.provider)?.icon}
                                        <div>
                                            <h3 className="font-semibold flex items-center gap-2">
                                                {config.name}
                                                {config.is_default && (
                                                    <Badge variant="default" className="gap-1">
                                                        <FaCheck className="h-3 w-3" />
                                                        Default
                                                    </Badge>
                                                )}
                                            </h3>
                                            <p className="text-sm text-muted-foreground">
                                                {config.provider.toUpperCase()} • {config.model}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleEditConfig(config)}
                                            className="h-9 w-9 p-0"
                                        >
                                            <FaEdit className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDelete(config.id)}
                                            className="h-9 w-9 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                        >
                                            <FaTrash className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                )}

                {/* Provider Selection */}
                {!selectedProvider && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Add New Configuration</CardTitle>
                            <CardDescription>Choose an AI provider to configure</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {providerTemplates.map((provider) => (
                                    <div
                                        key={provider.id}
                                        onClick={() => handleProviderSelect(provider.id)}
                                        className="relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:shadow-lg border-border hover:border-primary/50 hover:bg-muted/30"
                                    >
                                        {/* Popular badge */}
                                        {provider.popular && (
                                            <Badge className="absolute top-3 right-3 bg-green-500 hover:bg-green-500">
                                                Popular
                                            </Badge>
                                        )}

                                        <div className="flex items-start gap-3">
                                            <div className="text-2xl">{provider.icon}</div>
                                            <div className="flex-1">
                                                <h3 className="font-semibold text-lg">{provider.name}</h3>
                                                <p className="text-sm text-muted-foreground mt-1">
                                                    {provider.description}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Configuration Form */}
                {selectedTemplate && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                {selectedTemplate.icon}
                                {editingConfig ? 'Edit' : 'Configure'} {selectedTemplate.name}
                            </CardTitle>
                            <CardDescription>
                                {editingConfig ? 'Update your' : 'Set up your'} {selectedTemplate.name} configuration
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Configuration Name */}
                                <div className="space-y-2">
                                    <Label htmlFor="name">Configuration Name *</Label>
                                    <Input
                                        id="name"
                                        placeholder="My OpenAI Config"
                                        value={formData.name}
                                        onChange={(e) => handleInputChange("name", e.target.value)}
                                        required
                                    />
                                </div>

                                {/* API Key Field */}
                                {selectedProvider !== 'ollama' && (
                                    <div className="space-y-2">
                                        <Label htmlFor="api_key">API Key *</Label>
                                        <Input
                                            id="api_key"
                                            type="password"
                                            placeholder="Enter your API key"
                                            value={formData.api_key}
                                            onChange={(e) => handleInputChange("api_key", e.target.value)}
                                            className="font-mono"
                                            required
                                        />
                                    </div>
                                )}

                                {/* URL Field */}
                                <div className="space-y-2">
                                    <Label htmlFor="base_url">API URL</Label>
                                    <Input
                                        id="base_url"
                                        type="url"
                                        placeholder={selectedTemplate.defaultUrl || "Enter API URL"}
                                        value={formData.base_url}
                                        onChange={(e) => handleInputChange("base_url", e.target.value)}
                                    />
                                </div>

                                {/* Model Field */}
                                <div className="space-y-2">
                                    <Label htmlFor="model">Model Name *</Label>
                                    <Input
                                        id="model"
                                        placeholder="e.g., gpt-4, gemini-pro, llama2"
                                        value={formData.model}
                                        onChange={(e) => handleInputChange("model", e.target.value)}
                                        required
                                    />
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {selectedTemplate.defaultModels.map((model) => (
                                            <Badge
                                                key={model}
                                                variant="outline"
                                                className="cursor-pointer text-xs hover:bg-muted"
                                                onClick={() => handleInputChange("model", model)}
                                            >
                                                {model}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>

                                {/* Temperature */}
                                <div className="space-y-2">
                                    <Label htmlFor="temperature">Temperature</Label>
                                    <Input
                                        id="temperature"
                                        type="number"
                                        min="0"
                                        max="2"
                                        step="0.1"
                                        value={formData.temperature}
                                        onChange={(e) => handleInputChange("temperature", parseFloat(e.target.value))}
                                    />
                                    <p className="text-xs text-muted-foreground">Controls randomness (0 = focused, 2 = creative)</p>
                                </div>

                                {/* Max Tokens */}
                                <div className="space-y-2">
                                    <Label htmlFor="max_tokens">Max Tokens</Label>
                                    <Input
                                        id="max_tokens"
                                        type="number"
                                        min="1"
                                        value={formData.max_tokens || ""}
                                        onChange={(e) => handleInputChange("max_tokens", e.target.value ? parseInt(e.target.value) : null)}
                                        placeholder="1000"
                                    />
                                    <p className="text-xs text-muted-foreground">Maximum response length (optional)</p>
                                </div>
                            </div>

                            <Separator />

                            {/* Default Switch */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label htmlFor="is_default" className="text-base font-medium">Default Configuration</Label>
                                    <p className="text-sm text-muted-foreground">Use this as the default for new chats</p>
                                </div>
                                <Switch
                                    id="is_default"
                                    checked={formData.is_default}
                                    onCheckedChange={(checked) => handleInputChange("is_default", checked)}
                                />
                            </div>

                            {/* Action Buttons */}
                            <div className="space-y-3">
                                <div className="flex gap-3">
                                    <Button 
                                        onClick={handleSave} 
                                        disabled={saving}
                                        className="px-6"
                                    >
                                        {saving ? (
                                            <>
                                                <FaSpinner className="mr-2 h-4 w-4 animate-spin" />
                                                Saving...
                                            </>
                                        ) : (
                                            <>
                                                {editingConfig ? 'Update' : 'Save'} Configuration
                                            </>
                                        )}
                                    </Button>
                                    
                                    {selectedProvider !== 'ollama' && formData.api_key && (
                                        <Button 
                                            variant="outline" 
                                            onClick={handleTestConnection}
                                            disabled={testing}
                                        >
                                            {testing ? (
                                                <>
                                                    <FaSpinner className="mr-2 h-4 w-4 animate-spin" />
                                                    Testing...
                                                </>
                                            ) : (
                                                <>
                                                    <FaPlug className="mr-2 h-4 w-4" />
                                                    Test Connection
                                                </>
                                            )}
                                        </Button>
                                    )}
                                    
                                    <Button variant="outline" onClick={handleCancel}>
                                        Cancel
                                    </Button>
                                </div>
                                
                                {/* Test Connection Info */}
                                {selectedProvider !== 'ollama' && (
                                    <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
                                        <p className="font-medium mb-1">💡 About Connection Testing:</p>
                                        <p>
                                            Most AI APIs block direct browser requests (CORS policy). If you see a CORS error, 
                                            don't worry - your configuration will still work in actual chats. The test helps 
                                            verify your API URL format and credentials when possible.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {!selectedProvider && configs.length === 0 && !loading && (
                    <Card>
                        <CardContent className="text-center py-12">
                            <FaCog className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                            <h3 className="text-lg font-medium mb-2">No Configurations Yet</h3>
                            <p className="text-muted-foreground">
                                Select an AI provider above to create your first configuration
                            </p>
                        </CardContent>
                    </Card>
                )}
                    </div>
                </div>
            </ScrollArea>
        </div>
    );
}
