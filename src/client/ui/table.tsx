import type { ComponentPropsWithoutRef } from 'react';
import { cn } from './cn';

/** Provides a horizontally scrollable semantic table surface. */
export function Table({
  className,
  ...props
}: ComponentPropsWithoutRef<'table'>) {
  return (
    <div className="tap-ui-table-container" data-slot="table-container">
      <table
        {...props}
        className={cn('tap-ui-table', className)}
        data-slot="table"
      />
    </div>
  );
}

/** Groups table header rows. */
export function TableHeader({
  className,
  ...props
}: ComponentPropsWithoutRef<'thead'>) {
  return (
    <thead
      {...props}
      className={cn('tap-table__header', className)}
      data-slot="table-header"
    />
  );
}

/** Groups table body rows. */
export function TableBody({
  className,
  ...props
}: ComponentPropsWithoutRef<'tbody'>) {
  return (
    <tbody
      {...props}
      className={cn('tap-table__body', className)}
      data-slot="table-body"
    />
  );
}

/** Props for a semantic table row. */
export interface TableRowProps extends ComponentPropsWithoutRef<'tr'> {
  variant?: 'header' | 'body';
}

/** Renders a table row with header or body styling. */
export function TableRow({
  className,
  variant = 'body',
  ...props
}: TableRowProps) {
  return (
    <tr
      {...props}
      className={cn('tap-table__row', className)}
      data-slot="table-row"
      data-variant={variant}
    />
  );
}

/** Renders a semantic table column heading. */
export function TableHead({
  className,
  ...props
}: ComponentPropsWithoutRef<'th'>) {
  return (
    <th
      {...props}
      className={cn('tap-table__head', className)}
      data-slot="table-head"
    />
  );
}

/** Renders a semantic table data cell. */
export function TableCell({
  className,
  ...props
}: ComponentPropsWithoutRef<'td'>) {
  return (
    <td
      {...props}
      className={cn('tap-table__cell', className)}
      data-slot="table-cell"
    />
  );
}
