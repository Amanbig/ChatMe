import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FaCheck, FaTimes, FaTools, FaChevronDown, FaChevronUp } from 'react-icons/fa';
import type { ToolExecution } from '@/lib/types';
import { useState } from 'react';

interface ToolExecutionDisplayProps {
  executions: ToolExecution[];
}

export default function ToolExecutionDisplay({ executions }: ToolExecutionDisplayProps) {
  const [expandedExecutions, setExpandedExecutions] = useState<Set<string>>(new Set());

  const toggleExpanded = (toolCallId: string) => {
    setExpandedExecutions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(toolCallId)) {
        newSet.delete(toolCallId);
      } else {
        newSet.add(toolCallId);
      }
      return newSet;
    });
  };

  if (!executions || executions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 my-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
        <FaTools size={14} />
        <span className="font-medium">Tool Executions ({executions.length})</span>
      </div>

      {executions.map((exec) => {
        const isExpanded = expandedExecutions.has(exec.tool_call_id);

        return (
          <Card
            key={exec.tool_call_id}
            className="border-l-4 border-l-primary/50 bg-muted/30"
          >
            <CardHeader className="py-2 px-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FaTools className="text-primary" size={12} />
                  <CardTitle className="text-sm font-medium">
                    {exec.tool_name}
                  </CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={exec.success ? "default" : "destructive"}
                    className="text-xs"
                  >
                    {exec.success ? (
                      <>
                        <FaCheck size={10} className="mr-1" />
                        Success
                      </>
                    ) : (
                      <>
                        <FaTimes size={10} className="mr-1" />
                        Failed
                      </>
                    )}
                  </Badge>
                  <button
                    onClick={() => toggleExpanded(exec.tool_call_id)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {isExpanded ? (
                      <FaChevronUp size={12} />
                    ) : (
                      <FaChevronDown size={12} />
                    )}
                  </button>
                </div>
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent className="py-2 px-3 text-xs space-y-2">
                <details className="cursor-pointer">
                  <summary className="font-medium text-muted-foreground mb-1">
                    Arguments
                  </summary>
                  <pre className="bg-background/50 p-2 rounded text-xs overflow-x-auto border">
                    {JSON.stringify(exec.arguments, null, 2)}
                  </pre>
                </details>

                {exec.success && exec.result && (
                  <details className="cursor-pointer">
                    <summary className="font-medium text-muted-foreground mb-1">
                      Result
                    </summary>
                    <pre className="bg-background/50 p-2 rounded text-xs overflow-x-auto border">
                      {typeof exec.result === 'string'
                        ? exec.result
                        : JSON.stringify(exec.result, null, 2)}
                    </pre>
                  </details>
                )}

                {!exec.success && exec.error_message && (
                  <div className="mt-2">
                    <p className="font-medium text-destructive mb-1">Error:</p>
                    <p className="text-destructive/80 bg-destructive/10 p-2 rounded border border-destructive/20">
                      {exec.error_message}
                    </p>
                  </div>
                )}

                <div className="text-[10px] text-muted-foreground pt-1 border-t">
                  Executed at: {new Date(exec.timestamp).toLocaleTimeString()}
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
