import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from './cn';

/** Props for an extension page heading with optional actions. */
export interface PageHeaderProps extends Omit<
  ComponentPropsWithoutRef<'header'>,
  'title'
> {
  actions?: ReactNode;
  description?: ReactNode;
  title: ReactNode;
}

/**
 * Introduces a settings panel or a section with a title, supporting copy, and
 * optional actions.
 *
 * @remarks
 * Leave it out of a page: Tappify draws a page's header itself, with the
 * extension's name, the page title and the connection state.
 */
export function PageHeader({
  actions,
  className,
  description,
  title,
  ...props
}: PageHeaderProps) {
  return (
    <header
      {...props}
      className={cn('tap-ui-page-header', className)}
      data-slot="page-header"
    >
      <div className="tap-page-header__copy" data-slot="page-header-copy">
        <h2 className="tap-page-header__title" data-slot="page-header-title">
          {title}
        </h2>
        {description ? (
          <div
            className="tap-page-header__description"
            data-slot="page-header-description"
          >
            {description}
          </div>
        ) : null}
      </div>
      {actions ? (
        <div
          className="tap-page-header__actions"
          data-slot="page-header-actions"
        >
          {actions}
        </div>
      ) : null}
    </header>
  );
}
