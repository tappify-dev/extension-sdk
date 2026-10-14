import type { ComponentPropsWithoutRef } from 'react';
import { cn } from './cn';

export function Table({
  className,
  ...props
}: ComponentPropsWithoutRef<'table'>) {
  return (
    <div className="tap-table-container" data-slot="table-container">
      <table
        {...props}
        className={cn('tap-table', className)}
        data-slot="table"
      />
    </div>
  );
}

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

export interface TableRowProps extends ComponentPropsWithoutRef<'tr'> {
  variant?: 'header' | 'body';
}

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
