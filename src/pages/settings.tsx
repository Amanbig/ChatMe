import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
    FaRobot, 
    FaGoogle, 
    FaServer, 
    FaCog, 
    FaDesktop,
    FaCode,
    FaCheck
} from "react-icons/fa";

interface Provider {
    id: string;
    name: string;
    icon: React.ReactNode;
    description: string;
    fields: {
        apiKey?: boolean;
        url?: boolean;
        model?: boolean;
        customFields?: { name: string; label: string; placeholder: string; required?: boolean }[];
    };
    defaultUrl?: string;
    popular?: boolean;
}

const providers: Provider[] = [
    {
        id: "openai",
        name: "OpenAI",
        icon: <FaRobot className="text-green-600" />,
        description: "GPT-4, GPT-3.5 and other OpenAI models",
        fields: { apiKey: true, model: true, url: true },
        defaultUrl: "https://api.openai.com/v1",
        popular: true
    },
    {
        id: "gemini",
        name: "Google Gemini", 
        icon: <FaGoogle className="text-blue-600" />,
        description: "Google's Gemini Pro and Ultra models",
        fields: { apiKey: true, model: true, url: true },
        defaultUrl: "https://generativelanguage.googleapis.com/v1beta",
        popular: true
    },
    {
        id: "mistral",
        name: "Mistral AI",
        icon: <FaRobot className="text-orange-600" />,
        description: "Mistral 7B, 8x7B and other Mistral models",
        fields: { apiKey: true, model: true, url: true },
        defaultUrl: "https://api.mistral.ai/v1"
    },
    {
        id: "openai-compatible",
        name: "OpenAI Compatible",
        icon: <FaServer className="text-purple-600" />,
        description: "Any OpenAI-compatible API endpoint",
        fields: { apiKey: true, url: true, model: true }
    },
    {
        id: "ollama",
        name: "Ollama",
        icon: <FaCog className="text-gray-600" />,
        description: "Local models via Ollama",
        fields: { url: true, model: true },
        defaultUrl: "http://localhost:11434"
    },
    {
        id: "lmstudio",
        name: "LM Studio",
        icon: <FaDesktop className="text-indigo-600" />,
        description: "Local models via LM Studio",
        fields: { url: true, model: true },
        defaultUrl: "http://localhost:1234/v1"
    },
    {
        id: "anthropic",
        name: "Anthropic Claude",
        icon: <FaCode className="text-red-600" />,
        description: "Claude 3 and other Anthropic models",
        fields: { apiKey: true, model: true, url: true },
        defaultUrl: "https://api.anthropic.com/v1"
    }
];

export default function SettingsPage() {
    const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
    const [settings, setSettings] = useState<Record<string, any>>({});

    const handleProviderSelect = (providerId: string) => {
        setSelectedProvider(selectedProvider === providerId ? null : providerId);
    };

    const handleInputChange = (field: string, value: string) => {
        setSettings(prev => ({
            ...prev,
            [selectedProvider!]: {
                ...prev[selectedProvider!],
                [field]: value
            }
        }));
    };

    const handleSave = () => {
        console.log("Saving settings:", settings);
        // Here you would typically save to localStorage or send to backend
    };

    const selectedProviderData = providers.find(p => p.id === selectedProvider);
    const currentSettings = selectedProvider ? settings[selectedProvider] || {} : {};

    return (
        <div className="min-h-screen bg-background p-8">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-foreground mb-2">Settings</h1>
                    <p className="text-muted-foreground">Configure your AI providers and preferences</p>
                </div>

                {/* Provider Selection */}
                <div className="mb-8">
                    <h2 className="text-xl font-semibold mb-4">AI Providers</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {providers.map((provider) => (
                            <div
                                key={provider.id}
                                onClick={() => handleProviderSelect(provider.id)}
                                className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:shadow-md ${
                                    selectedProvider === provider.id
                                        ? "border-primary bg-primary/5"
                                        : "border-border hover:border-primary/50"
                                }`}
                            >
                                {/* Selection indicator */}
                                {selectedProvider === provider.id && (
                                    <div className="absolute top-3 right-3">
                                        <div className="h-6 w-6 bg-primary rounded-full flex items-center justify-center">
                                            <FaCheck size={12} className="text-primary-foreground" />
                                        </div>
                                    </div>
                                )}

                                {/* Popular badge */}
                                {provider.popular && (
                                    <Badge className="absolute top-3 left-3 bg-green-500 hover:bg-green-500">
                                        Popular
                                    </Badge>
                                )}

                                <div className="flex items-start gap-3 mt-2">
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

                {/* Configuration Form */}
                {selectedProviderData && (
                    <div className="bg-muted/20 rounded-xl p-6 border">
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            {selectedProviderData.icon}
                            Configure {selectedProviderData.name}
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            {/* API Key Field */}
                            {selectedProviderData.fields.apiKey && (
                                <div className="space-y-2">
                                    <Label htmlFor="apiKey">API Key</Label>
                                    <Input
                                        id="apiKey"
                                        type="password"
                                        placeholder="Enter your API key"
                                        value={currentSettings.apiKey || ""}
                                        onChange={(e) => handleInputChange("apiKey", e.target.value)}
                                        className="font-mono"
                                    />
                                </div>
                            )}

                            {/* URL Field */}
                            {selectedProviderData.fields.url && (
                                <div className="space-y-2">
                                    <Label htmlFor="url">API URL</Label>
                                    <Input
                                        id="url"
                                        type="url"
                                        placeholder={selectedProviderData.defaultUrl || "Enter API URL"}
                                        value={currentSettings.url || selectedProviderData.defaultUrl || ""}
                                        onChange={(e) => handleInputChange("url", e.target.value)}
                                    />
                                </div>
                            )}

                            {/* Model Field */}
                            {selectedProviderData.fields.model && (
                                <div className="space-y-2">
                                    <Label htmlFor="model">Model Name</Label>
                                    <Input
                                        id="model"
                                        placeholder="e.g., gpt-4, gemini-pro, llama2"
                                        value={currentSettings.model || ""}
                                        onChange={(e) => handleInputChange("model", e.target.value)}
                                    />
                                </div>
                            )}

                            {/* Custom Fields */}
                            {selectedProviderData.fields.customFields?.map((field) => (
                                <div key={field.name} className="space-y-2">
                                    <Label htmlFor={field.name}>{field.label}</Label>
                                    <Input
                                        id={field.name}
                                        placeholder={field.placeholder}
                                        value={currentSettings[field.name] || ""}
                                        onChange={(e) => handleInputChange(field.name, e.target.value)}
                                    />
                                </div>
                            ))}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3">
                            <Button onClick={handleSave} className="px-6">
                                Save Configuration
                            </Button>
                            <Button 
                                variant="outline" 
                                onClick={() => console.log("Testing connection...")}
                            >
                                Test Connection
                            </Button>
                        </div>
                    </div>
                )}

                {!selectedProvider && (
                    <div className="text-center py-12">
                        <p className="text-muted-foreground text-lg">
                            Select an AI provider above to configure its settings
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}