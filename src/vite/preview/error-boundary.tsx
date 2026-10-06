import { Component, type ErrorInfo, type ReactNode } from 'react';

interface PreviewErrorBoundaryProps {
  children: ReactNode;
}

interface PreviewErrorBoundaryState {
  error: Error | null;
}

export class PreviewErrorBoundary extends Component<
  PreviewErrorBoundaryProps,
  PreviewErrorBoundaryState
> {
  state: PreviewErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): PreviewErrorBoundaryState {
    return { error };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // The visible diagnostic is the local preview's reporting boundary.
  }

  render(): ReactNode {
    if (this.state.error !== null) {
      return (
        <div className="tap-preview-message" role="alert">
          <strong>The contribution could not render.</strong>
          <span>{this.state.error.message}</span>
        </div>
      );
    }
    return this.props.children;
  }
}
