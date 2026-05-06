import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#242424] text-gray-100 p-4">
          <div className="bg-[#2f2f2f] border border-red-500/30 p-6 rounded-xl max-w-2xl w-full shadow-2xl">
            <h1 className="text-2xl font-bold text-red-400 mb-4">Something went wrong</h1>
            <div className="bg-[#1e1e1e] p-4 rounded-lg overflow-auto max-h-[400px]">
              <pre className="text-sm text-gray-300 whitespace-pre-wrap">
                {this.state.error?.message || 'Unknown error'}
                {'\n\n'}
                {this.state.error?.stack}
              </pre>
            </div>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-6 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
