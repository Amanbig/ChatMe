import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
    FaRobot, 
    FaGoogle, 
    FaServer, 
    FaCog, 
    FaCode,
    FaTrash,
    FaEdit
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
        description: "Google's Gemini Pro and Ultra models",
        defaultUrl: "https://generativelanguage.googleapis.com/v1beta",
        defaultModels: ["gemini-pro", "gemini-pro-vision"],
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
        description: "Any custom API endpoint",
        defaultModels: ["custom-model"]
    }
];

export default function SettingsPage() {
    const [configs, setConfigs] = useState<ApiConfig[]>([]);
    const [selectedProvider, setSelectedProvider] = useState<ApiProvider | null>(null);
    const [editingConfig, setEditingConfig] = useState<ApiConfig | null>(null);
    const [loading, setLoading] = useState(true);
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

        try {
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
            } else {
                await createApiConfig(request);
            }

            await loadConfigs();
            handleCancel();
        } catch (error) {
            console.error('Failed to save configuration:', error);
            alert('Failed to save configuration. Please check your inputs.');
        }
    };

    const handleDelete = async (configId: string) => {
        if (confirm('Are you sure you want to delete this configuration?')) {
            try {
                await deleteApiConfig(configId);
                await loadConfigs();
            } catch (error) {
                console.error('Failed to delete configuration:', error);
                const errorMessage = error instanceof Error ? error.message : String(error);
                if (errorMessage.includes('last API configuration')) {
                    alert('Cannot delete the last API configuration. You must have at least one configuration.');
                } else if (errorMessage.includes('being used by chats')) {
                    alert('Cannot delete this configuration because it is being used by existing chats.');
                } else {
                    alert('Failed to delete configuration: ' + errorMessage);
                }
            }
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

    const selectedTemplate = selectedProvider ? providerTemplates.find(p => p.id === selectedProvider) : null;

    return (
        <div className="min-h-screen bg-background p-8">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-foreground mb-2">Settings</h1>
                    <p className="text-muted-foreground">Configure your AI providers and preferences</p>
                </div>

                {/* Existing Configurations */}
                {!loading && configs.length > 0 && (
                    <div className="mb-8">
                        <h2 className="text-xl font-semibold mb-4">Your Configurations</h2>
                        <div className="grid gap-4">
                            {configs.map((config) => (
                                <div
                                    key={config.id}
                                    className="p-4 rounded-xl border bg-card"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            {providerTemplates.find(p => p.id === config.provider)?.icon}
                                            <div>
                                                <h3 className="font-semibold flex items-center gap-2">
                                                    {config.name}
                                                    {config.is_default && (
                                                        <Badge variant="default">Default</Badge>
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
                                            >
                                                <FaEdit className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDelete(config.id)}
                                                className="text-destructive hover:text-destructive"
                                            >
                                                <FaTrash className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Provider Selection */}
                {!selectedProvider && (
                    <div className="mb-8">
                        <h2 className="text-xl font-semibold mb-4">Add New Configuration</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {providerTemplates.map((provider) => (
                                <div
                                    key={provider.id}
                                    onClick={() => handleProviderSelect(provider.id)}
                                    className="relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:shadow-md border-border hover:border-primary/50"
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
                    </div>
                )}

                {/* Configuration Form */}
                {selectedTemplate && (
                    <div className="bg-muted/20 rounded-xl p-6 border">
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            {selectedTemplate.icon}
                            {editingConfig ? 'Edit' : 'Configure'} {selectedTemplate.name}
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            {/* Configuration Name */}
                            <div className="space-y-2">
                                <Label htmlFor="name">Configuration Name</Label>
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
                                    <Label htmlFor="api_key">API Key</Label>
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
                                <Label htmlFor="base_url">API URL (Optional)</Label>
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
                                <Label htmlFor="model">Model Name</Label>
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
                                            className="cursor-pointer text-xs"
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
                            </div>

                            {/* Max Tokens */}
                            <div className="space-y-2">
                                <Label htmlFor="max_tokens">Max Tokens (Optional)</Label>
                                <Input
                                    id="max_tokens"
                                    type="number"
                                    min="1"
                                    value={formData.max_tokens || ""}
                                    onChange={(e) => handleInputChange("max_tokens", e.target.value ? parseInt(e.target.value) : null)}
                                    placeholder="1000"
                                />
                            </div>
                        </div>

                        {/* Default Switch */}
                        <div className="flex items-center space-x-2 mb-6">
                            <Switch
                                id="is_default"
                                checked={formData.is_default}
                                onCheckedChange={(checked) => handleInputChange("is_default", checked)}
                            />
                            <Label htmlFor="is_default">Set as default configuration</Label>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3">
                            <Button onClick={handleSave} className="px-6">
                                {editingConfig ? 'Update' : 'Save'} Configuration
                            </Button>
                            <Button variant="outline" onClick={handleCancel}>
                                Cancel
                            </Button>
                        </div>
                    </div>
                )}

                {!selectedProvider && configs.length === 0 && !loading && (
                    <div className="text-center py-12">
                        <p className="text-muted-foreground text-lg">
                            Select an AI provider above to create your first configuration
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}