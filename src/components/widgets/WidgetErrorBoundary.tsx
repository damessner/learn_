"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertOctagon } from "lucide-react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class WidgetErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("WidgetErrorBoundary caught an error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 border border-red-200 dark:border-red-950/50 bg-red-50/50 dark:bg-red-950/10 rounded flex flex-col items-center text-center gap-3 my-4">
          <div className="p-3 bg-red-100 dark:bg-red-950 text-red-650 dark:text-red-400 rounded-full border border-red-200/50 dark:border-red-900/50">
            <AlertOctagon className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h4 className="font-bold text-sm text-neutral-800 dark:text-neutral-200 uppercase tracking-wide font-mono">
              Exercise Component Failed
            </h4>
            <p className="text-xs text-neutral-500 max-w-sm leading-relaxed">
              Could not load this task. Teacher, please verify the worksheet configuration or package assets.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
