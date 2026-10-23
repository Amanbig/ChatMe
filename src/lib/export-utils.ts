import type { Message } from './types';
import { toast } from 'sonner';

/**
 * Downloads a file directly in the browser/Tauri webview
 */
function downloadFile(filename: string, content: string, contentType: string) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Sanitize chat title for filename
 */
function sanitizeFilename(title: string): string {
    return (title || 'chat')
        .toLowerCase()
        .replace(/[^a-z0-9-_]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'chat';
}

/**
 * Export conversation to clean GitHub Flavored Markdown
 */
export function exportChatToMarkdown(chatTitle: string, messages: Message[]): void {
    if (!messages || messages.length === 0) {
        toast.warning('No messages to export');
        return;
    }

    let md = `# ${chatTitle || 'Chat Export'}\n\n`;
    md += `*Exported from ChatMe on ${new Date().toLocaleString()}*\n\n---\n\n`;

    for (const msg of messages) {
        const roleLabel = msg.role === 'user' ? '👤 User' : msg.role === 'assistant' ? '🤖 Assistant' : '⚙️ System';
        const timestamp = msg.created_at ? new Date(msg.created_at).toLocaleString() : '';

        md += `### ${roleLabel} ${timestamp ? `*(${timestamp})*` : ''}\n\n`;
        md += `${msg.content}\n\n---\n\n`;
    }

    const filename = `${sanitizeFilename(chatTitle)}-${Date.now()}.md`;
    downloadFile(filename, md, 'text/markdown;charset=utf-8');
    toast.success(`Exported chat to ${filename}`);
}

/**
 * Export conversation to structured JSON for backup/migration
 */
export function exportChatToJson(chatTitle: string, messages: Message[]): void {
    if (!messages || messages.length === 0) {
        toast.warning('No messages to export');
        return;
    }

    const payload = {
        title: chatTitle,
        exportedAt: new Date().toISOString(),
        version: '1.0',
        messageCount: messages.length,
        messages: messages.map(m => ({
            id: m.id,
            role: m.role,
            content: m.content,
            createdAt: m.created_at
        }))
    };

    const filename = `${sanitizeFilename(chatTitle)}-${Date.now()}.json`;
    downloadFile(filename, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
    toast.success(`Exported chat to ${filename}`);
}
