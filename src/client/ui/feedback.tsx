import type { CSSProperties, ReactNode } from 'react';
import { Button } from './button';
import { cn } from './cn';
import { Stack } from './layout';

export interface MetricProps {
  delta?: number;
  description?: ReactNode;
  label: ReactNode;
  value: ReactNode;
}

export function Metric({ delta, description, label, value }: MetricProps) {
  const percent = delta === undefined ? undefined : Math.round(delta * 100);
  const direction =
    percent === undefined || percent === 0
      ? 'flat'
      : percent > 0
        ? 'up'
        : 'down';
  return (
    <div className="tap-metric" data-slot="metric">
      <div className="tap-metric__label" data-slot="metric-label">
        {label}
      </div>
      <div className="tap-metric__value" data-slot="metric-value">
        {value}
      </div>
      {percent !== undefined ? (
        <div
          className="tap-metric__delta"
          data-direction={direction}
          data-slot="metric-delta"
        >
          {percent > 0 ? '+' : ''}
          {percent}%
        </div>
      ) : null}
      {description ? (
        <div className="tap-metric__description" data-slot="metric-description">
          {description}
        </div>
      ) : null}
    </div>
  );
}

export interface SkeletonProps {
  className?: string;
  lines?: number;
  width?: CSSProperties['width'];
}

export function Skeleton({ className, lines = 1, width }: SkeletonProps) {
  return (
    <div className={cn('tap-ui-skeleton', className)} data-slot="skeleton">
      {Array.from({ length: Math.max(0, lines) }, (_, index) => (
        <span
          className="tap-skeleton__line"
          data-slot="skeleton-line"
          key={index}
          style={{ width }}
        />
      ))}
    </div>
  );
}

export interface EmptyStateProps {
  action?: ReactNode;
  description?: ReactNode;
  title: ReactNode;
}

export function EmptyState({ action, description, title }: EmptyStateProps) {
  return (
    <Stack className="tap-ui-state" data-slot="empty-state" gap={12}>
      <div className="tap-state__title">{title}</div>
      {description ? (
        <div className="tap-state__description">{description}</div>
      ) : null}
      {action ? <div className="tap-state__action">{action}</div> : null}
    </Stack>
  );
}

export interface ErrorStateProps {
  code?: ReactNode;
  description?: ReactNode;
  onRetry?: () => void;
  title: ReactNode;
}

export function ErrorState({
  code,
  description,
  onRetry,
  title,
}: ErrorStateProps) {
  return (
    <Stack
      className="tap-ui-state tap-ui-state--error"
      data-slot="error-state"
      gap={12}
      role="alert"
    >
      <div className="tap-state__title">{title}</div>
      {description ? (
        <div className="tap-state__description">{description}</div>
      ) : null}
      {code ? <code className="tap-state__code">{code}</code> : null}
      {onRetry ? (
        <div className="tap-state__action">
          <Button variant="secondary" onClick={onRetry}>
            Try again
          </Button>
        </div>
      ) : null}
    </Stack>
  );
}
