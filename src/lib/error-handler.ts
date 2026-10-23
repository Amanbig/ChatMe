/**
 * Centralized Application Error Handler
 * Parses, categorizes, and provides actionable user-friendly messages for API, System, and Tool errors.
 */

import { toast } from 'sonner';

export interface AppErrorDetails {
    title: string;
    message: string;
    actionLabel?: string;
    actionType?: 'settings' | 'retry' | 'network' | 'permission';
    category: 'auth' | 'rate_limit' | 'model' | 'network' | 'server' | 'permission' | 'filesystem' | 'command' | 'unknown';
    isRetryable: boolean;
    rawMessage?: string;
}

export function parseAppError(error: unknown, fallbackMessage: string = 'An unexpected error occurred'): AppErrorDetails {
    let rawStr = '';

    if (typeof error === 'string') {
        rawStr = error;
    } else if (error instanceof Error) {
        rawStr = error.message;
    } else if (error && typeof error === 'object') {
        if ('message' in error && typeof (error as any).message === 'string') {
            rawStr = (error as any).message;
        } else if ('error' in error) {
            rawStr = typeof (error as any).error === 'string' 
                ? (error as any).error 
                : JSON.stringify((error as any).error);
        } else {
            rawStr = JSON.stringify(error);
        }
    }

    const lower = rawStr.toLowerCase();

    // 1. Authentication / API Key errors
    if (lower.includes('401') || lower.includes('unauthorized') || lower.includes('api key') || lower.includes('invalid_api_key') || lower.includes('incorrect api key') || lower.includes('authentication')) {
        return {
            title: 'Authentication Error',
            message: 'Your API key is missing, invalid, or expired. Please update it in Settings > API Configs.',
            actionLabel: 'Open Settings',
            actionType: 'settings',
            category: 'auth',
            isRetryable: false,
            rawMessage: rawStr
        };
    }

    // 2. Rate limiting / Quota errors
    if (lower.includes('429') || lower.includes('rate limit') || lower.includes('quota') || lower.includes('too many requests') || lower.includes('resource exhausted')) {
        return {
            title: 'Rate Limit Reached',
            message: 'The AI provider is throttling requests or your account quota is exhausted. Please wait a moment before trying again.',
            actionLabel: 'Retry',
            actionType: 'retry',
            category: 'rate_limit',
            isRetryable: true,
            rawMessage: rawStr
        };
    }

    // 3. Model not found errors
    if (lower.includes('404') || lower.includes('model not found') || lower.includes('does not exist') || lower.includes('unsupported model')) {
        return {
            title: 'Model Not Found',
            message: 'The selected AI model is not available for this provider configuration. Please select a valid model in Settings.',
            actionLabel: 'Select Model',
            actionType: 'settings',
            category: 'model',
            isRetryable: false,
            rawMessage: rawStr
        };
    }

    // 4. Network / Connectivity errors
    if (lower.includes('failed to fetch') || lower.includes('network error') || lower.includes('connection refused') || lower.includes('enotfound') || lower.includes('econnrefused') || lower.includes('dns') || lower.includes('timeout') || lower.includes('timed out')) {
        return {
            title: 'Connection Failed',
            message: 'Unable to reach the server. Please check your internet connection or verify the base URL in Settings.',
            actionLabel: 'Retry Connection',
            actionType: 'retry',
            category: 'network',
            isRetryable: true,
            rawMessage: rawStr
        };
    }

    // 5. Server side errors
    if (lower.includes('500') || lower.includes('502') || lower.includes('503') || lower.includes('504') || lower.includes('overloaded') || lower.includes('bad gateway') || lower.includes('internal server error')) {
        return {
            title: 'AI Service Overloaded',
            message: 'The upstream AI provider is currently experiencing issues or high traffic. Please retry in a few moments.',
            actionLabel: 'Retry',
            actionType: 'retry',
            category: 'server',
            isRetryable: true,
            rawMessage: rawStr
        };
    }

    // 6. Permission denied errors
    if (lower.includes('permission denied') || lower.includes('requires explicit') || lower.includes('eacces')) {
        return {
            title: 'Permission Denied',
            message: rawStr || 'This action was blocked because it requires user authorization or elevated permissions.',
            actionLabel: 'Review Permissions',
            actionType: 'permission',
            category: 'permission',
            isRetryable: false,
            rawMessage: rawStr
        };
    }

    // 7. File system errors
    if (lower.includes('no such file') || lower.includes('not a directory') || lower.includes('enoent') || lower.includes('is a directory')) {
        return {
            title: 'File System Error',
            message: rawStr || 'The requested file or directory does not exist.',
            category: 'filesystem',
            isRetryable: false,
            rawMessage: rawStr
        };
    }

    // 8. Command execution errors
    if (lower.includes('command not found') || lower.includes('exit code') || lower.includes('127')) {
        return {
            title: 'Command Failed',
            message: rawStr,
            category: 'command',
            isRetryable: false,
            rawMessage: rawStr
        };
    }

    // Default unknown error
    return {
        title: 'Error',
        message: rawStr || fallbackMessage,
        category: 'unknown',
        isRetryable: true,
        rawMessage: rawStr
    };
}

export function notifyAppError(error: unknown, fallbackMessage?: string) {
    const parsed = parseAppError(error, fallbackMessage);
    toast.error(parsed.title, {
        description: parsed.message
    });
    return parsed;
}
