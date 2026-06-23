import React, { Component } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  name?: string;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.name ? `:${this.props.name}` : ''}]`, error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[200px] px-6 text-center">
          <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center mb-3">
            <AlertTriangle className="w-5 h-5 text-rose-400" />
          </div>
          <p className="text-sm text-slate-700 dark:text-slate-300 font-medium mb-1">
            {this.props.name || 'Este módulo'} tuvo un problema temporal
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-3 max-w-[240px]">
            Ocurrió un error inesperado. Puedes intentar de nuevo.
          </p>
          <button
            onClick={this.handleRetry}
            className="flex items-center gap-1.5 text-xs text-[#3390ec] hover:text-[#1a7ad9] font-semibold transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
