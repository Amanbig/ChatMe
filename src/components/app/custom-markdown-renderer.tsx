import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import FileListDisplay from "./file-list-display";
import CommandExecution from "./command-execution";
import CodeBlock from "./code-block";

interface CustomMarkdownRendererProps {
    content: string;
}

function extractText(node: any): string {
    if (!node) return '';
    if (typeof node === 'string') return node;
    if (Array.isArray(node)) return node.map(extractText).join('');
    if (node.props?.children) return extractText(node.props.children);
    return '';
}

const markdownComponents = {
    pre: ({ children }: any) => <div className="not-prose my-1">{children}</div>,
    code: ({ className, children, ...props }: any) => {
        const isInline = !className?.includes('language-');
        if (isInline) {
            return (
                <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono font-medium text-foreground/90 border border-border/40" {...props}>
                    {children}
                </code>
            );
        }
        const match = /language-(\w+)/.exec(className || '');
        const language = match ? match[1] : '';
        const rawCode = extractText(children).replace(/\n$/, '');

        return (
            <CodeBlock language={language} value={rawCode}>
                <code className={className} {...props}>
                    {children}
                </code>
            </CodeBlock>
        );
    }
};

export default function CustomMarkdownRenderer({ content }: CustomMarkdownRendererProps) {
    // Check if content contains custom components
    const fileListRegex = /<file-list-component data='([^']+)'><\/file-list-component>/g;
    const commandExecRegex = /<command-execution data='([^']+)'><\/command-execution>/g;
    
    // Find all custom components
    const allMatches = [
        ...[...content.matchAll(fileListRegex)].map(m => ({ type: 'file-list', match: m })),
        ...[...content.matchAll(commandExecRegex)].map(m => ({ type: 'command', match: m }))
    ].sort((a, b) => (a.match.index || 0) - (b.match.index || 0));
    
    const matches = allMatches;
    
    if (matches.length === 0) {
        // No custom components, render with regular ReactMarkdown
        return (
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight, rehypeRaw]}
                components={markdownComponents}
            >
                {content}
            </ReactMarkdown>
        );
    }
    
    // Split content and render custom components mixed with markdown
    const parts = [];
    let lastIndex = 0;
    
    matches.forEach((item, index) => {
        const match = item.match;
        // Add text before the component
        if (match.index! > lastIndex) {
            const textBefore = content.slice(lastIndex, match.index);
            if (textBefore.trim()) {
                parts.push(
                    <ReactMarkdown
                        key={`text-${index}`}
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeHighlight, rehypeRaw]}
                        components={markdownComponents}
                    >
                        {textBefore}
                    </ReactMarkdown>
                );
            }
        }
        
        // Add the custom component
        try {
            const componentData = JSON.parse(match[1]);
            if (item.type === 'file-list' && componentData.type === 'file-list') {
                parts.push(
                    <FileListDisplay
                        key={`file-list-${index}`}
                        directories={componentData.directories}
                        files={componentData.files}
                        basePath={componentData.basePath}
                    />
                );
            } else if (item.type === 'command') {
                parts.push(
                    <CommandExecution
                        key={`command-${index}`}
                        command={componentData.command}
                        result={componentData.result}
                        status={componentData.status || 'success'}
                        type={componentData.type}
                        working_directory={componentData.working_directory}
                    />
                );
            }
        } catch (error) {
            console.error('Error parsing component data:', error);
        }
        
        lastIndex = match.index! + match[0].length;
    });
    
    // Add remaining text
    if (lastIndex < content.length) {
        const textAfter = content.slice(lastIndex);
        if (textAfter.trim()) {
            parts.push(
                <ReactMarkdown
                    key="text-end"
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeHighlight, rehypeRaw]}
                    components={markdownComponents}
                >
                    {textAfter}
                </ReactMarkdown>
            );
        }
    }
    
    return <div>{parts}</div>;
}
