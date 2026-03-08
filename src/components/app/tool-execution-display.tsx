import { Card, CardContent } from '@/components/ui/card';
import { FaCheck, FaTimes, FaCog } from 'react-icons/fa';
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
    <div className="space-y-1.5 my-2">
      {executions.map((exec) => {
        const isExpanded = expandedExecutions.has(exec.tool_call_id);

        // Get a short summary of arguments for compact view
        const getArgsSummary = () => {
          const args = exec.arguments;
          const keys = Object.keys(args);
          if (keys.length === 0) return '';
          if (keys.length === 1) {
            const value = args[keys[0]];
            const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
            return valueStr.length > 40 ? valueStr.substring(0, 40) + '...' : valueStr;
          }
          return `${keys.length} parameters`;
        };

        return (
          <div key={exec.tool_call_id}>
            {/* Compact CLI-style display */}
            <div
              onClick={() => toggleExpanded(exec.tool_call_id)}
              className="flex items-center gap-2 px-3 py-1.5 bg-muted/40 border-l-2 border-l-primary/60 rounded-r cursor-pointer hover:bg-muted/60 transition-colors group"
            >
              <FaCog className={`${exec.success ? 'text-green-500' : 'text-destructive'} text-xs`} />
              <span className="text-xs font-mono text-foreground/90">
                {exec.tool_name}
              </span>
              {getArgsSummary() && (
                <span className="text-xs text-muted-foreground font-mono truncate flex-1">
                  ({getArgsSummary()})
                </span>
              )}
              <div className="flex items-center gap-2 ml-auto">
                {exec.success ? (
                  <FaCheck className="text-green-500 text-xs" />
                ) : (
                  <FaTimes className="text-destructive text-xs" />
                )}
                <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                  {isExpanded ? 'collapse' : 'expand'}
                </span>
              </div>
            </div>

            {/* Expanded details */}
            {isExpanded && (
              <Card className="ml-6 mt-1 border-l-2 border-l-primary/40 bg-muted/20">
                <CardContent className="py-2 px-3 text-xs space-y-2">
                  <div>
                    <p className="font-medium text-muted-foreground mb-1 text-[10px] uppercase tracking-wide">
                      Arguments
                    </p>
                    <pre className="bg-background/50 p-2 rounded text-xs overflow-x-auto border font-mono">
                      {JSON.stringify(exec.arguments, null, 2)}
                    </pre>
                  </div>

                  {exec.success && exec.result && (
                    <div>
                      <p className="font-medium text-muted-foreground mb-1 text-[10px] uppercase tracking-wide">
                        Result
                      </p>
                      <pre className="bg-background/50 p-2 rounded text-xs overflow-x-auto border font-mono max-h-40">
                        {typeof exec.result === 'string'
                          ? exec.result
                          : JSON.stringify(exec.result, null, 2)}
                      </pre>
                    </div>
                  )}

                  {!exec.success && exec.error_message && (
                    <div>
                      <p className="font-medium text-destructive mb-1 text-[10px] uppercase tracking-wide">
                        Error
                      </p>
                      <p className="text-destructive/90 bg-destructive/10 p-2 rounded border border-destructive/20 text-xs font-mono">
                        {exec.error_message}
                      </p>
                    </div>
                  )}

                  <div className="text-[10px] text-muted-foreground pt-1 border-t font-mono">
                    {new Date(exec.timestamp).toLocaleTimeString()}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        );
      })}
    </div>
  );
}
