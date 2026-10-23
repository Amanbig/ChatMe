import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
    FONT_FAMILY_OPTIONS,
    CODE_FONT_OPTIONS,
    DEFAULT_TYPOGRAPHY,
    getTypographySettings,
    saveTypographySettings,
    type TypographySettings
} from '@/lib/appearance';
import {
    FaFont,
    FaCode,
    FaExpandAlt,
    FaUndo,
    FaCheck,
    FaEye,
    FaSlidersH
} from 'react-icons/fa';

export default function AppearanceSettings() {
    const [settings, setSettings] = useState<TypographySettings>(getTypographySettings);

    const updateSetting = <K extends keyof TypographySettings>(key: K, value: TypographySettings[K]) => {
        const updated = { ...settings, [key]: value };
        setSettings(updated);
        saveTypographySettings(updated);
    };

    const handleReset = () => {
        setSettings(DEFAULT_TYPOGRAPHY);
        saveTypographySettings(DEFAULT_TYPOGRAPHY);
        toast.info('Appearance reset to default settings');
    };

    const fontSizes = [
        { label: 'Tiny', size: 12 },
        { label: 'Compact (Default)', size: 13 },
        { label: 'Standard', size: 14 },
        { label: 'Medium', size: 15 },
        { label: 'Large', size: 16 }
    ];

    const codeFontSizes = [
        { label: '11px', size: 11 },
        { label: '12px (Default)', size: 12 },
        { label: '13px', size: 13 },
        { label: '14px', size: 14 }
    ];

    const densities = [
        { id: 'compact', label: 'Compact', desc: 'Tight spacing for maximum message visibility' },
        { id: 'comfortable', label: 'Comfortable', desc: 'Balanced padding and readability (Recommended)' },
        { id: 'spacious', label: 'Spacious', desc: 'Relaxed breathing room for extended reading' }
    ] as const;

    const lineHeights = [
        { id: 'tight', label: 'Compact (1.4)' },
        { id: 'normal', label: 'Balanced (1.6)' },
        { id: 'relaxed', label: 'Relaxed (1.8)' }
    ] as const;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                        <FaFont className="text-primary" />
                        Appearance & Typography
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Customize typography, UI density, font sizes, and code block styling across ChatMe.
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReset}
                    className="text-xs rounded-xl h-8 gap-1.5 hover:bg-muted"
                >
                    <FaUndo size={11} />
                    Reset Defaults
                </Button>
            </div>

            {/* Live Interactive Preview */}
            <Card className="border-border/60 bg-gradient-to-br from-card/80 to-muted/20 backdrop-blur-md shadow-xs">
                <CardHeader className="py-3 px-4 border-b border-border/40">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                            <FaEye size={12} className="text-primary" />
                            Live Typography Preview
                        </CardTitle>
                        <Badge variant="outline" className="font-mono text-[10px]">
                            {settings.fontSize}px / {settings.density}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                    {/* User bubble preview */}
                    <div className="flex justify-end">
                        <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-xs px-3.5 py-2 max-w-sm text-xs shadow-xs">
                            Can you write a fast Python function to test GPU availability?
                        </div>
                    </div>

                    {/* Assistant response preview */}
                    <div className="flex justify-start">
                        <div className="bg-card border border-border/50 rounded-2xl rounded-tl-xs px-4 py-3 max-w-md shadow-xs space-y-2">
                            <p className="text-foreground leading-relaxed">
                                Certainly! Here is a concise snippet checking CUDA and ROCm acceleration in PyTorch:
                            </p>
                            <div className="rounded-lg bg-black/80 text-emerald-400 p-2.5 font-mono text-[12px] border border-border/30 overflow-x-auto" style={{ fontFamily: settings.codeFontFamily, fontSize: `${settings.codeFontSize}px` }}>
                                <code>
                                    <span className="text-purple-400">import</span> torch<br />
                                    device = <span className="text-amber-300">"cuda"</span> <span className="text-purple-400">if</span> torch.cuda.is_available() <span className="text-purple-400">else</span> <span className="text-amber-300">"cpu"</span><br />
                                    print(<span className="text-amber-300">f"Active compute device: &#123;device&#125;"</span>)
                                </code>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Primary Font Family */}
                <Card className="border-border/60">
                    <CardHeader className="py-3 px-4 border-b border-border/40">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <FaFont size={13} className="text-primary" />
                            Primary Font Family
                        </CardTitle>
                        <CardDescription className="text-xs">
                            Applied to chat conversations, navigation, and input areas.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 space-y-2">
                        {FONT_FAMILY_OPTIONS.map((font) => {
                            const isSelected = settings.fontFamily === font.value;
                            return (
                                <div
                                    key={font.id}
                                    onClick={() => updateSetting('fontFamily', font.value)}
                                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                                        isSelected
                                            ? 'border-primary bg-primary/5 shadow-xs'
                                            : 'border-border/50 hover:bg-muted/40 hover:border-border'
                                    }`}
                                >
                                    <div>
                                        <p className="text-sm font-medium" style={{ fontFamily: font.value }}>
                                            {font.name}
                                        </p>
                                        <p className="text-[11px] text-muted-foreground">
                                            {font.description}
                                        </p>
                                    </div>
                                    {isSelected && <FaCheck className="text-primary shrink-0" size={13} />}
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>

                {/* Code Font Family */}
                <Card className="border-border/60">
                    <CardHeader className="py-3 px-4 border-b border-border/40">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <FaCode size={13} className="text-primary" />
                            Code & Terminal Font
                        </CardTitle>
                        <CardDescription className="text-xs">
                            Applied to Markdown code blocks, diffs, and terminal output.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 space-y-2">
                        {CODE_FONT_OPTIONS.map((codeFont) => {
                            const isSelected = settings.codeFontFamily === codeFont.value;
                            return (
                                <div
                                    key={codeFont.id}
                                    onClick={() => updateSetting('codeFontFamily', codeFont.value)}
                                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                                        isSelected
                                            ? 'border-primary bg-primary/5 shadow-xs'
                                            : 'border-border/50 hover:bg-muted/40 hover:border-border'
                                    }`}
                                >
                                    <div>
                                        <p className="text-xs font-mono font-medium" style={{ fontFamily: codeFont.value }}>
                                            {codeFont.name}
                                        </p>
                                        <span className="text-[10px] text-muted-foreground font-mono">
                                            const ready = true;
                                        </span>
                                    </div>
                                    {isSelected && <FaCheck className="text-primary shrink-0" size={13} />}
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>
            </div>

            {/* Font Sizes & Spacing */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Base Font Size */}
                <Card className="border-border/60">
                    <CardHeader className="py-3 px-4 border-b border-border/40">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <FaSlidersH size={13} className="text-primary" />
                            Message Font Size
                        </CardTitle>
                        <CardDescription className="text-xs">
                            Adjust base reading scale for all messages.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4">
                        <div className="grid grid-cols-3 gap-2">
                            {fontSizes.map((item) => (
                                <Button
                                    key={item.size}
                                    variant={settings.fontSize === item.size ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => updateSetting('fontSize', item.size)}
                                    className="h-10 flex flex-col gap-0.5 rounded-xl text-xs cursor-pointer"
                                >
                                    <span className="font-semibold">{item.size}px</span>
                                    <span className="text-[10px] opacity-75">{item.label}</span>
                                </Button>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Code Font Size */}
                <Card className="border-border/60">
                    <CardHeader className="py-3 px-4 border-b border-border/40">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <FaCode size={13} className="text-primary" />
                            Code Snippet Font Size
                        </CardTitle>
                        <CardDescription className="text-xs">
                            Adjust font scale inside code blocks.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4">
                        <div className="grid grid-cols-3 gap-2">
                            {codeFontSizes.map((item) => (
                                <Button
                                    key={item.size}
                                    variant={settings.codeFontSize === item.size ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => updateSetting('codeFontSize', item.size)}
                                    className="h-10 flex flex-col gap-0.5 rounded-xl text-xs font-mono cursor-pointer"
                                >
                                    <span className="font-semibold">{item.size}px</span>
                                    <span className="text-[9px] opacity-75 truncate">{item.label}</span>
                                </Button>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Layout Density & Line Height */}
            <Card className="border-border/60">
                <CardHeader className="py-3 px-4 border-b border-border/40">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <FaExpandAlt size={13} className="text-primary" />
                        Chat Layout Density
                    </CardTitle>
                    <CardDescription className="text-xs">
                        Control message padding, vertical margins, and conversation spacing.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                        {densities.map((item) => {
                            const isSelected = settings.density === item.id;
                            return (
                                <div
                                    key={item.id}
                                    onClick={() => updateSetting('density', item.id)}
                                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                                        isSelected
                                            ? 'border-primary bg-primary/5 shadow-xs'
                                            : 'border-border/50 hover:bg-muted/40 hover:border-border'
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <p className="text-xs font-semibold text-foreground">{item.label}</p>
                                        {isSelected && <FaCheck className="text-primary" size={11} />}
                                    </div>
                                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                                        {item.desc}
                                    </p>
                                </div>
                            );
                        })}
                    </div>

                    {/* Line height */}
                    <div className="pt-2 border-t border-border/40">
                        <Label className="text-xs font-medium text-foreground block mb-2">
                            Reading Line Spacing (Line Height)
                        </Label>
                        <div className="grid grid-cols-3 gap-2">
                            {lineHeights.map((item) => (
                                <Button
                                    key={item.id}
                                    variant={settings.lineHeight === item.id ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => updateSetting('lineHeight', item.id)}
                                    className="h-8 rounded-xl text-xs cursor-pointer"
                                >
                                    {item.label}
                                </Button>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
