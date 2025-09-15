import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import FileListDisplay from "./file-list-display";
import CommandExecution from "./command-execution";

interface CustomMarkdownRendererProps {
    content: string;
}

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
                components={{
                    code: ({ className, children, ...props }: any) => {
                        const isInline = !className?.includes('language-');
                        return isInline ? (
                            <code className="bg-muted-foreground/20 px-1.5 py-0.5 rounded text-xs font-mono" {...props}>
                                {children}
                            </code>
                        ) : (
                            <code className={className} {...props}>
                                {children}
                            </code>
                        );
                    }
                }}
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
                        components={{
                            code: ({ className, children, ...props }: any) => {
                                const isInline = !className?.includes('language-');
                                return isInline ? (
                                    <code className="bg-muted-foreground/20 px-1.5 py-0.5 rounded text-xs font-mono" {...props}>
                                        {children}
                                    </code>
                                ) : (
                                    <code className={className} {...props}>
                                        {children}
                                    </code>
                                );
                            }
                        }}
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
                    components={{
                        code: ({ className, children, ...props }: any) => {
                            const isInline = !className?.includes('language-');
                            return isInline ? (
                                <code className="bg-muted-foreground/20 px-1.5 py-0.5 rounded text-xs font-mono" {...props}>
                                    {children}
                                </code>
                            ) : (
                                <code className={className} {...props}>
                                    {children}
                                </code>
                            );
                        }
                    }}
                >
                    {textAfter}
                </ReactMarkdown>
            );
        }
    }
    
    return <div>{parts}</div>;
}
