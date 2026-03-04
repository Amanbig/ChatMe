import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import SpeechSettings from "@/components/app/speech-settings";
import AgentMode from "../components/app/agent-mode";
import ModelSelector from "@/components/app/model-selector";
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
    FaPlug,
    FaMicrophone,
    FaBrain,
    FaSlidersH,
    FaKey,
    FaPlus,
    FaTimes,
    FaSave
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
    color: string;
}

const providerTemplates: ProviderTemplate[] = [
    {
        id: "openai",
        name: "OpenAI",
        icon: <FaRobot className="text-green-600" size={24} />,
        description: "GPT-4, GPT-3.5 and other OpenAI models",
        defaultUrl: "https://api.openai.com/v1/chat/completions",
        defaultModels: ["gpt-4-turbo-preview", "gpt-4", "gpt-3.5-turbo"],
        popular: true,
        color: "from-green-500 to-emerald-600"
    },
    {
        id: "google",
        name: "Google Gemini",
        icon: <FaGoogle className="text-blue-600" size={24} />,
        description: "Google's Gemini models",
        defaultUrl: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        defaultModels: ["gemini-pro", "gemini-1.5-flash", "gemini-1.5-pro"],
        popular: true,
        color: "from-blue-500 to-cyan-600"
    },
    {
        id: "anthropic",
        name: "Anthropic Claude",
        icon: <FaCode className="text-orange-600" size={24} />,
        description: "Claude 3 Opus, Sonnet, and Haiku",
        defaultUrl: "https://api.anthropic.com/v1/messages",
        defaultModels: ["claude-3-opus-20240229", "claude-3-sonnet-20240229", "claude-3-haiku-20240307"],
        color: "from-orange-500 to-red-600"
    },
    {
        id: "mistral",
        name: "Mistral AI",
        icon: <FaRobot className="text-amber-600" size={24} />,
        description: "Mistral models with function calling",
        defaultUrl: "https://api.mistral.ai/v1",
        defaultModels: ["mistral-large-latest", "mistral-medium-latest", "mistral-small-latest"],
        color: "from-amber-500 to-yellow-600"
    },
    {
        id: "deepseek",
        name: "DeepSeek",
        icon: <FaBrain className="text-indigo-600" size={24} />,
        description: "DeepSeek's powerful coding models",
        defaultUrl: "https://api.deepseek.com/v1",
        defaultModels: ["deepseek-chat", "deepseek-coder"],
        color: "from-indigo-500 to-purple-600"
    },
    {
        id: "kimi",
        name: "Kimi (Moonshot)",
        icon: <FaRobot className="text-pink-600" size={24} />,
        description: "Moonshot AI's Kimi models",
        defaultUrl: "https://api.moonshot.cn/v1",
        defaultModels: ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"],
        color: "from-pink-500 to-rose-600"
    },
    {
        id: "openrouter",
        name: "OpenRouter",
        icon: <FaRobot className="text-sky-600" size={24} />,
        description: "Access 100+ models via unified API",
        defaultUrl: "https://openrouter.ai/api/v1",
        defaultModels: ["openai/gpt-4-turbo", "anthropic/claude-3-opus", "google/gemini-pro"],
        popular: true,
        color: "from-sky-500 to-blue-600"
    },
    {
        id: "together",
        name: "Together AI",
        icon: <FaBrain className="text-violet-600" size={24} />,
        description: "Fast inference for open-source models",
        defaultUrl: "https://api.together.xyz/v1",
        defaultModels: ["mistralai/Mixtral-8x7B-Instruct-v0.1", "meta-llama/Llama-3-70b-chat-hf"],
        color: "from-violet-500 to-purple-600"
    },
    {
        id: "groq",
        name: "Groq",
        icon: <FaRobot className="text-emerald-600" size={24} />,
        description: "Fastest LLM inference available",
        defaultUrl: "https://api.groq.com/openai/v1",
        defaultModels: ["llama3-70b-8192", "mixtral-8x7b-32768", "gemma-7b-it"],
        popular: true,
        color: "from-emerald-500 to-green-600"
    },
    {
        id: "perplexity",
        name: "Perplexity",
        icon: <FaCode className="text-cyan-600" size={24} />,
        description: "Perplexity's search-powered models",
        defaultUrl: "https://api.perplexity.ai",
        defaultModels: ["llama-3-sonar-large-32k-online", "llama-3-sonar-small-32k-chat"],
        color: "from-cyan-500 to-teal-600"
    },
    {
        id: "lmstudio",
        name: "LM Studio",
        icon: <FaCode className="text-teal-600" size={24} />,
        description: "Local models via LM Studio",
        defaultUrl: "http://localhost:1234/v1",
        defaultModels: ["local-model"],
        color: "from-teal-500 to-cyan-600"
    },
    {
        id: "ollama",
        name: "Ollama",
        icon: <FaCog className="text-gray-600" size={24} />,
        description: "Local models via Ollama",
        defaultUrl: "http://localhost:11434/v1",
        defaultModels: ["llama2", "codellama", "mistral", "neural-chat"],
        color: "from-gray-500 to-slate-600"
    },
    {
        id: "custom",
        name: "Custom API",
        icon: <FaServer className="text-purple-600" size={24} />,
        description: "OpenAI-compatible APIs",
        defaultModels: ["custom-model"],
        color: "from-purple-500 to-violet-600"
    }
];

type TabType = 'api' | 'agent' | 'speech';

// Edit Form Component - shown inline
function ConfigEditForm({
    config,
    providerTemplate,
    onSave,
    onCancel,
    onDelete,
    saving
}: {
    config: ApiConfig;
    providerTemplate: ProviderTemplate;
    onSave: (data: any) => void;
    onCancel: () => void;
    onDelete: () => void;
    saving: boolean;
}) {
    const [formData, setFormData] = useState({
        name: config.name,
        api_key: config.api_key,
        base_url: config.base_url || "",
        model: config.model,
        temperature: config.temperature,
        max_tokens: config.max_tokens,
        is_default: config.is_default,
    });

    return (
        <div className="p-5 rounded-xl border-2 border-primary/30 bg-primary/5 animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${providerTemplate.color} flex items-center justify-center text-white`}>
                    {providerTemplate.icon}
                </div>
                <div>
                    <h3 className="font-semibold">Edit Configuration</h3>
                    <p className="text-xs text-muted-foreground">{providerTemplate.name}</p>
                </div>
            </div>

            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="edit-name">Configuration Name</Label>
                        <Input
                            id="edit-name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="My API Configuration"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="edit-model">Model</Label>
                        <ModelSelector
                            provider={config.provider}
                            apiKey={formData.api_key}
                            baseUrl={formData.base_url}
                            value={formData.model}
                            onChange={(value) => setFormData({ ...formData, model: value })}
                            placeholder="Select a model"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="edit-api-key">API Key</Label>
                    <Input
                        id="edit-api-key"
                        type="password"
                        value={formData.api_key}
                        onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                        placeholder="Enter your API key"
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="edit-base-url">Base URL (Optional)</Label>
                    <Input
                        id="edit-base-url"
                        value={formData.base_url}
                        onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
                        placeholder="https://api.example.com/v1"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="edit-temperature">Temperature ({formData.temperature})</Label>
                        <Input
                            id="edit-temperature"
                            type="number"
                            min="0"
                            max="2"
                            step="0.1"
                            value={formData.temperature}
                            onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="edit-max-tokens">Max Tokens (Optional)</Label>
                        <Input
                            id="edit-max-tokens"
                            type="number"
                            value={formData.max_tokens || ''}
                            onChange={(e) => setFormData({ ...formData, max_tokens: e.target.value ? parseInt(e.target.value) : null })}
                            placeholder="Leave empty for default"
                        />
                    </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2">
                        <Switch
                            checked={formData.is_default}
                            onCheckedChange={(checked) => setFormData({ ...formData, is_default: checked })}
                        />
                        <Label className="text-sm cursor-pointer">Set as default</Label>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onCancel}
                            disabled={saving}
                            className="gap-1"
                        >
                            <FaTimes size={12} />
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={onDelete}
                            disabled={saving}
                            className="gap-1"
                        >
                            <FaTrash size={12} />
                            Delete
                        </Button>
                        <Button
                            size="sm"
                            onClick={() => onSave(formData)}
                            disabled={saving}
                            className="gap-1"
                        >
                            {saving ? <FaSpinner size={12} className="animate-spin" /> : <FaSave size={12} />}
                            Save
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Create Form Component - shown inline when adding new
function CreateConfigForm({
    providerTemplate,
    onSave,
    onCancel,
    saving,
    configs
}: {
    providerTemplate: ProviderTemplate;
    onSave: (data: any) => void;
    onCancel: () => void;
    saving: boolean;
    configs: ApiConfig[];
}) {
    const [formData, setFormData] = useState({
        name: `${providerTemplate.name} Configuration`,
        api_key: "",
        base_url: providerTemplate.defaultUrl || "",
        model: providerTemplate.defaultModels[0] || "",
        temperature: 0.7,
        max_tokens: null as number | null,
        is_default: configs.length === 0,
    });

    return (
        <div className="p-5 rounded-xl border-2 border-green-500/30 bg-green-500/5 animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${providerTemplate.color} flex items-center justify-center text-white`}>
                    {providerTemplate.icon}
                </div>
                <div>
                    <h3 className="font-semibold">New Configuration</h3>
                    <p className="text-xs text-muted-foreground">{providerTemplate.name}</p>
                </div>
            </div>

            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="new-name">Configuration Name</Label>
                        <Input
                            id="new-name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="My API Configuration"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="new-model">Model</Label>
                        <ModelSelector
                            provider={providerTemplate.id}
                            apiKey={formData.api_key}
                            baseUrl={formData.base_url}
                            value={formData.model}
                            onChange={(value) => setFormData({ ...formData, model: value })}
                            placeholder="Select a model"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="new-api-key">API Key</Label>
                    <Input
                        id="new-api-key"
                        type="password"
                        value={formData.api_key}
                        onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                        placeholder="Enter your API key"
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="new-base-url">Base URL (Optional)</Label>
                    <Input
                        id="new-base-url"
                        value={formData.base_url}
                        onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
                        placeholder="https://api.example.com/v1"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="new-temperature">Temperature ({formData.temperature})</Label>
                        <Input
                            id="new-temperature"
                            type="number"
                            min="0"
                            max="2"
                            step="0.1"
                            value={formData.temperature}
                            onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="new-max-tokens">Max Tokens (Optional)</Label>
                        <Input
                            id="new-max-tokens"
                            type="number"
                            value={formData.max_tokens || ''}
                            onChange={(e) => setFormData({ ...formData, max_tokens: e.target.value ? parseInt(e.target.value) : null })}
                            placeholder="Leave empty for default"
                        />
                    </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2">
                        <Switch
                            checked={formData.is_default}
                            onCheckedChange={(checked) => setFormData({ ...formData, is_default: checked })}
                        />
                        <Label className="text-sm cursor-pointer">Set as default</Label>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onCancel}
                            disabled={saving}
                            className="gap-1"
                        >
                            <FaTimes size={12} />
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            onClick={() => onSave({ ...formData, provider: providerTemplate.id })}
                            disabled={saving}
                            className="gap-1 bg-green-600 hover:bg-green-700"
                        >
                            {saving ? <FaSpinner size={12} className="animate-spin" /> : <FaPlus size={12} />}
                            Create
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState<TabType>('api');
    const [configs, setConfigs] = useState<ApiConfig[]>([]);
    const [editingConfigId, setEditingConfigId] = useState<string | null>(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Add new config flow states
    const [showAddNew, setShowAddNew] = useState(false);
    const [selectedProviderForNew, setSelectedProviderForNew] = useState<ProviderTemplate | null>(null);

    // Speech settings state
    const [speechEnabled, setSpeechEnabled] = useState(() => {
        const saved = localStorage.getItem('speechEnabled');
        return saved ? JSON.parse(saved) : true;
    });
    const [autoSpeak, setAutoSpeak] = useState(() => {
        const saved = localStorage.getItem('autoSpeak');
        return saved ? JSON.parse(saved) : false;
    });

    useEffect(() => {
        loadConfigs();
    }, []);

    // Auto-reset delete confirmation after 3 seconds
    useEffect(() => {
        if (deleteConfirmId) {
            const timer = setTimeout(() => {
                setDeleteConfirmId(null);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [deleteConfirmId]);

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

    const handleSaveEdit = async (configId: string, formData: any) => {
        if (!formData.name.trim()) {
            toast.error('Please enter a configuration name');
            return;
        }
        if (!formData.model.trim()) {
            toast.error('Please enter a model name');
            return;
        }

        try {
            setSaving(true);
            await updateApiConfig(configId, formData);
            toast.success('Configuration updated successfully!');
            setEditingConfigId(null);
            await loadConfigs();
        } catch (error) {
            console.error('Failed to save configuration:', error);
            toast.error('Failed to save configuration');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (configId: string) => {
        try {
            await deleteApiConfig(configId);
            setEditingConfigId(null);
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

    const handleSpeechEnabledChange = (enabled: boolean) => {
        setSpeechEnabled(enabled);
        localStorage.setItem('speechEnabled', JSON.stringify(enabled));
    };

    const handleAutoSpeakChange = (enabled: boolean) => {
        setAutoSpeak(enabled);
        localStorage.setItem('autoSpeak', JSON.stringify(enabled));
    };

    const handleCreateNew = async (formData: any) => {
        if (!formData.name.trim()) {
            toast.error('Please enter a configuration name');
            return;
        }
        if (!formData.model.trim()) {
            toast.error('Please enter a model name');
            return;
        }
        if (formData.provider !== 'ollama' && !formData.api_key.trim()) {
            toast.error('Please enter an API key');
            return;
        }

        try {
            setSaving(true);
            await createApiConfig(formData);
            toast.success('Configuration created successfully!');
            setSelectedProviderForNew(null);
            setShowAddNew(false);
            await loadConfigs();
        } catch (error) {
            console.error('Failed to create configuration:', error);
            toast.error('Failed to create configuration');
        } finally {
            setSaving(false);
        }
    };

    const tabs = [
        { id: 'api' as TabType, label: 'API Configs', icon: <FaKey size={16} /> },
        { id: 'agent' as TabType, label: 'Agent Mode', icon: <FaBrain size={16} /> },
        { id: 'speech' as TabType, label: 'Speech', icon: <FaMicrophone size={16} /> },
    ];

    return (
        <div className="h-full flex flex-col overflow-hidden bg-background">
            {/* Header */}
            <div className="flex items-center gap-4 px-6 py-4 border-b border-border/60 bg-card/50">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center shrink-0">
                    <FaSlidersH size={20} className="text-primary" />
                </div>
                <div className="flex-1">
                    <h1 className="text-xl font-bold text-foreground">Settings</h1>
                    <p className="text-xs text-muted-foreground">Configure your AI providers and preferences</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 px-6 py-3 border-b border-border/40 bg-background">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${activeTab === tab.id
                            ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                            }`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <ScrollArea className="flex-1 h-0">
                <div className="p-6">
                    <div className="max-w-4xl mx-auto">
                        {/* API Configurations Tab */}
                        {activeTab === 'api' && (
                            <div className="space-y-6">
                                {/* Existing Configurations */}
                                {!loading && configs.length > 0 && (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h2 className="text-lg font-semibold flex items-center gap-2">
                                                <FaPlug className="text-primary" />
                                                Your Configurations
                                            </h2>
                                            <Badge variant="secondary">{configs.length} active</Badge>
                                        </div>

                                        {configs.map((config) => {
                                            const template = providerTemplates.find(p => p.id === config.provider);
                                            const isEditing = editingConfigId === config.id;

                                            if (isEditing) {
                                                return (
                                                    <ConfigEditForm
                                                        key={config.id}
                                                        config={config}
                                                        providerTemplate={template!}
                                                        onSave={(data) => handleSaveEdit(config.id, data)}
                                                        onCancel={() => setEditingConfigId(null)}
                                                        onDelete={() => handleDelete(config.id)}
                                                        saving={saving}
                                                    />
                                                );
                                            }

                                            return (
                                                <div
                                                    key={config.id}
                                                    className="flex items-center justify-between p-4 rounded-xl border border-border/60 bg-card hover:border-primary/30 hover:shadow-md transition-all duration-200"
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${template?.color || 'from-gray-500 to-slate-600'} flex items-center justify-center text-white`}>
                                                            {template?.icon}
                                                        </div>
                                                        <div>
                                                            <h3 className="font-semibold flex items-center gap-2">
                                                                {config.name}
                                                                {config.is_default && (
                                                                    <Badge variant="default" className="gap-1 text-[10px]">
                                                                        <FaCheck size={10} />
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
                                                            onClick={() => setEditingConfigId(config.id)}
                                                            className="h-8 w-8 p-0 rounded-lg hover:bg-primary/10 hover:text-primary"
                                                            title="Edit configuration"
                                                        >
                                                            <FaEdit size={14} />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (deleteConfirmId === config.id) {
                                                                    handleDelete(config.id);
                                                                    setDeleteConfirmId(null);
                                                                } else {
                                                                    setDeleteConfirmId(config.id);
                                                                }
                                                            }}
                                                            className={`h-8 w-8 p-0 rounded-lg transition-all ${
                                                                deleteConfirmId === config.id
                                                                    ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                                                                    : 'hover:bg-destructive/10 hover:text-destructive'
                                                            }`}
                                                            title={deleteConfirmId === config.id ? "Click again to confirm" : "Delete configuration"}
                                                        >
                                                            <FaTrash size={14} />
                                                        </Button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Loading State */}
                                {loading && (
                                    <div className="flex flex-col items-center justify-center py-12 gap-3">
                                        <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                                        <p className="text-sm text-muted-foreground">Loading configurations...</p>
                                    </div>
                                )}

                                {/* Empty State */}
                                {!loading && configs.length === 0 && (
                                    <div className="text-center py-12 px-4 border-2 border-dashed border-border/60 rounded-xl">
                                        <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                                            <FaPlug size={20} className="text-muted-foreground/50" />
                                        </div>
                                        <h3 className="font-semibold text-foreground mb-1">No configurations yet</h3>
                                        <p className="text-sm text-muted-foreground mb-4">Add your first AI provider to get started</p>
                                    </div>
                                )}

                                {/* Add New Flow */}
                                {!showAddNew ? (
                                    <Card className="border-border/60 border-dashed">
                                        <CardContent className="p-6">
                                            <div className="text-center">
                                                <Button
                                                    className="gap-2"
                                                    onClick={() => setShowAddNew(true)}
                                                >
                                                    <FaPlus size={14} />
                                                    Add New Configuration
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ) : !selectedProviderForNew ? (
                                    <Card className="border-border/60">
                                        <CardHeader className="pb-4">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <CardTitle className="text-lg flex items-center gap-2">
                                                        <FaPlus className="text-primary" />
                                                        Select Provider
                                                    </CardTitle>
                                                    <CardDescription>Choose an AI provider to configure</CardDescription>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setShowAddNew(false)}
                                                    className="h-8 w-8 p-0"
                                                >
                                                    <FaTimes size={14} />
                                                </Button>
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                {providerTemplates.map((provider) => (
                                                    <div
                                                        key={provider.id}
                                                        onClick={() => setSelectedProviderForNew(provider)}
                                                        className="relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:shadow-lg border-border hover:border-primary/50 hover:bg-muted/30 group"
                                                    >
                                                        {provider.popular && (
                                                            <Badge className="absolute top-3 right-3 bg-green-500 hover:bg-green-500 text-[10px]">
                                                                Popular
                                                            </Badge>
                                                        )}
                                                        <div className="flex items-start gap-3">
                                                            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${provider.color} flex items-center justify-center text-white shadow-md group-hover:scale-110 transition-transform duration-200`}>
                                                                {provider.icon}
                                                            </div>
                                                            <div className="flex-1">
                                                                <h3 className="font-semibold">{provider.name}</h3>
                                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                                    {provider.description}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    <CreateConfigForm
                                        providerTemplate={selectedProviderForNew}
                                        onSave={handleCreateNew}
                                        onCancel={() => {
                                            setSelectedProviderForNew(null);
                                            setShowAddNew(false);
                                        }}
                                        saving={saving}
                                        configs={configs}
                                    />
                                )}
                            </div>
                        )}

                        {/* Agent Mode Tab */}
                        {activeTab === 'agent' && (
                            <AgentMode />
                        )}

                        {/* Speech Settings Tab */}
                        {activeTab === 'speech' && (
                            <SpeechSettings
                                speechEnabled={speechEnabled}
                                onSpeechEnabledChange={handleSpeechEnabledChange}
                                autoSpeak={autoSpeak}
                                onAutoSpeakChange={handleAutoSpeakChange}
                            />
                        )}
                    </div>
                </div>
            </ScrollArea>
        </div>
    );
}
