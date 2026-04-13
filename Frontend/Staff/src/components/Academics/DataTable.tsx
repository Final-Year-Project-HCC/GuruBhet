"use client";

import React from "react";
import { FiEdit2, FiTrash2 } from "react-icons/fi";

export interface Column<T> {
  key: keyof T;
  label: string;
  render?: (value: T[keyof T], item: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  data: T[] | undefined;
  columns: Column<T>[];
  isLoading: boolean;
  isError: boolean;
  emptyStateText?: string;
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
  showActions?: boolean;
  rowClassName?: string;
  headerClassName?: string;
}

export function DataTable<T extends { id: string }>({
  data,
  columns,
  isLoading,
  isError,
  emptyStateText = "No data found",
  onEdit,
  onDelete,
  showActions = true,
  rowClassName = "",
  headerClassName = "",
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block mb-3">
            <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin"></div>
          </div>
          <p className="text-muted-foreground">Loading data...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <p className="text-red-500 font-medium mb-2">Error loading data</p>
          <p className="text-sm text-muted-foreground">Please refresh and try again</p>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 border border-dashed border-border rounded-lg bg-card/50">
        <div className="text-center">
          <div className="mb-2 text-2xl">📋</div>
          <p className="text-muted-foreground font-medium">{emptyStateText}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-border rounded-lg bg-background">
      <table className="w-full">
        <thead>
          <tr className={`border-b border-border bg-muted/30 ${headerClassName}`}>
            {columns.map((column) => (
              <th
                key={String(column.key)}
                className="px-6 py-3 text-left text-sm font-semibold text-foreground"
              >
                {column.label}
              </th>
            ))}
            {showActions && (onEdit || onDelete) && (
              <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => (
            <tr
              key={item.id}
              className={`border-b border-border hover:bg-muted/20 transition-colors ${index % 2 === 0 ? "" : "bg-card/40"
                } ${rowClassName}`}
            >
              {columns.map((column) => (
                <td
                  key={String(column.key)}
                  className={`px-6 py-4 text-sm text-foreground ${column.className || ""}`}
                >
                  {column.render
                    ? column.render(item[column.key], item)
                    : String(item[column.key] ?? "-")}
                </td>
              ))}
              {showActions && (onEdit || onDelete) && (
                <td className="px-6 py-4 text-sm">
                  <div className="flex items-center gap-2">
                    {onEdit && (
                      <button
                        onClick={() => onEdit(item)}
                        className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded transition-colors"
                        title="Edit"
                      >
                        <FiEdit2 size={16} />
                      </button>
                    )}
                    {onDelete && (
                      <button
                        onClick={() => onDelete(item)}
                        className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                        title="Delete"
                      >
                        <FiTrash2 size={16} />
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
