import React from 'react';
import { cn } from '../utils/cn';

export interface TapTableColumn<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
}

export interface TapTableProps<T> {
  columns: TapTableColumn<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  className?: string;
  emptyMessage?: string;
}

export function TapTable<T extends Record<string, unknown>>({
  columns,
  data,
  keyExtractor,
  className,
  emptyMessage = 'No data available',
}: TapTableProps<T>) {
  return (
    <div
      className={cn(
        'overflow-x-auto rounded-lg border border-neutral-200',
        className,
      )}
    >
      <table className="w-full text-left text-sm">
        <thead className="border-b border-neutral-200 bg-neutral-50">
          <tr>
            {columns.map(col => (
              <th
                key={col.key}
                className={cn(
                  'px-4 py-3 font-medium text-neutral-600',
                  col.className,
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-8 text-center text-neutral-500"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map(row => (
              <tr
                key={keyExtractor(row)}
                className="border-b border-neutral-100 last:border-0"
              >
                {columns.map(col => (
                  <td key={col.key} className={cn('px-4 py-3', col.className)}>
                    {col.render
                      ? col.render(row)
                      : (row[col.key] as React.ReactNode)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
