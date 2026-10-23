/**
 * ChatMe Appearance & Typography Manager
 * Handles user customizable fonts, font sizes, density, and interface aesthetics.
 */

export interface TypographySettings {
    fontFamily: string;
    fontSize: number; // in pixels (e.g. 14)
    codeFontFamily: string;
    codeFontSize: number; // in pixels (e.g. 13)
    density: 'compact' | 'comfortable' | 'spacious';
    lineHeight: 'tight' | 'normal' | 'relaxed';
}

export const FONT_FAMILY_OPTIONS = [
    {
        id: 'system',
        name: 'System Default',
        value: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        description: 'Native OS font rendering'
    },
    {
        id: 'inter',
        name: 'Inter Sans',
        value: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        description: 'Clean, modern screen-optimized sans-serif'
    },
    {
        id: 'mono',
        name: 'Developer Monospace',
        value: '"JetBrains Mono", "Fira Code", "Cascadia Code", "Roboto Mono", monospace',
        description: 'Hacker & developer style fixed-width font'
    },
    {
        id: 'geist',
        name: 'Geist Sans',
        value: '"Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        description: 'Vercel-inspired high-precision typography'
    },
    {
        id: 'serif',
        name: 'Editorial Serif',
        value: 'Merriweather, Georgia, Cambria, "Times New Roman", serif',
        description: 'Warm, readable long-form serif'
    }
];

export const CODE_FONT_OPTIONS = [
    {
        id: 'jetbrains',
        name: 'JetBrains Mono',
        value: '"JetBrains Mono", "Fira Code", "Cascadia Code", "Courier New", monospace'
    },
    {
        id: 'fira',
        name: 'Fira Code',
        value: '"Fira Code", "Cascadia Code", monospace'
    },
    {
        id: 'cascadia',
        name: 'Cascadia Code',
        value: '"Cascadia Code", "JetBrains Mono", monospace'
    },
    {
        id: 'source',
        name: 'Source Code Pro',
        value: '"Source Code Pro", monospace'
    }
];

export const DEFAULT_TYPOGRAPHY: TypographySettings = {
    fontFamily: FONT_FAMILY_OPTIONS[0].value,
    fontSize: 13,
    codeFontFamily: CODE_FONT_OPTIONS[0].value,
    codeFontSize: 12,
    density: 'comfortable',
    lineHeight: 'normal'
};

const STORAGE_KEY = 'chatme_typography_settings';

export function getTypographySettings(): TypographySettings {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return { ...DEFAULT_TYPOGRAPHY, ...JSON.parse(stored) };
        }
    } catch (e) {
        console.error('Failed to load typography settings:', e);
    }
    return DEFAULT_TYPOGRAPHY;
}

export function applyTypography(settings: TypographySettings) {
    const root = document.documentElement;
    root.style.setProperty('--app-font-family', settings.fontFamily);
    root.style.setProperty('--app-font-size', `${settings.fontSize}px`);
    root.style.setProperty('--app-code-font', settings.codeFontFamily);
    root.style.setProperty('--app-code-font-size', `${settings.codeFontSize}px`);

    // Density padding adjustments
    if (settings.density === 'compact') {
        root.style.setProperty('--app-message-py', '0.5rem');
        root.style.setProperty('--app-message-gap', '0.5rem');
    } else if (settings.density === 'spacious') {
        root.style.setProperty('--app-message-py', '1rem');
        root.style.setProperty('--app-message-gap', '1.25rem');
    } else {
        root.style.setProperty('--app-message-py', '0.75rem');
        root.style.setProperty('--app-message-gap', '0.875rem');
    }

    // Line height
    if (settings.lineHeight === 'tight') {
        root.style.setProperty('--app-line-height', '1.4');
    } else if (settings.lineHeight === 'relaxed') {
        root.style.setProperty('--app-line-height', '1.8');
    } else {
        root.style.setProperty('--app-line-height', '1.6');
    }
}

export function saveTypographySettings(settings: TypographySettings) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        applyTypography(settings);
    } catch (e) {
        console.error('Failed to save typography settings:', e);
    }
}
