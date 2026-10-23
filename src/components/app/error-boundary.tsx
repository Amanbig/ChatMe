import { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in React tree:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen flex items-center justify-center bg-background p-6">
          <Card className="max-w-lg w-full border-destructive/40 shadow-xl bg-card">
            <CardHeader className="space-y-1">
              <div className="flex items-center gap-2.5 text-destructive">
                <AlertTriangle className="h-6 w-6" />
                <CardTitle className="text-xl">Something went wrong</CardTitle>
              </div>
              <CardDescription className="text-sm text-muted-foreground">
                ChatMe encountered an unexpected interface error. Your chat history is safe in the local database.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {this.state.error && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 text-xs font-mono text-destructive max-h-40 overflow-y-auto whitespace-pre-wrap break-words">
                  {this.state.error.toString()}
                </div>
              )}
              <div className="flex items-center gap-3 pt-2">
                <Button onClick={this.handleReload} className="gap-2 flex-1 cursor-pointer">
                  <RefreshCw className="h-4 w-4" />
                  Reload Application
                </Button>
                <Button onClick={this.handleReset} variant="outline" className="gap-2 flex-1 cursor-pointer">
                  <Home className="h-4 w-4" />
                  Go to Home
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
