"use client";

import { useState } from "react";
import { FiPlus, FiX, FiChevronDown } from "react-icons/fi";

export interface BulkInputItem {
  id: string;
  name: string;
  description?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

interface BulkInputFormProps {
  title: string;
  fields: {
    name: string;
    label: string;
    type?: "text" | "number" | "select";
    placeholder?: string;
    required?: boolean;
    options?: Array<{ label: string; value: string | number }>;
    helpText?: string;
  }[];
  onAdd: (items: BulkInputItem[]) => void;
  isLoading?: boolean;
  submitLabel?: string;
  maxItems?: number;
}

export default function BulkInputForm({
  title,
  fields,
  onAdd,
  isLoading = false,
  submitLabel = "Add Items",
  maxItems = 10,
}: BulkInputFormProps) {
  const [items, setItems] = useState<BulkInputItem[]>([{ id: "1", name: "" }]);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set(["1"]));

  const addItem = () => {
    if (items.length < maxItems) {
      const newId = (Math.max(...items.map((i) => parseInt(i.id))) + 1).toString();
      setItems([...items, { id: newId, name: "" }]);
      setExpandedItems(new Set(expandedItems).add(newId));
    }
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter((item) => item.id !== id));
      const newExpanded = new Set(expandedItems);
      newExpanded.delete(id);
      setExpandedItems(newExpanded);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateItem = (id: string, field: string, value: any) => {
    setItems(
      items.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const handleSubmit = () => {
    const validItems = items.filter((item) => item.name.trim());
    if (validItems.length > 0) {
      onAdd(validItems);
      setItems([{ id: "1", name: "" }]);
      setExpandedItems(new Set(["1"]));
    }
  };

  const isValid = items.some((item) => item.name.trim());

  return (
    <div className="w-full space-y-4 rounded-lg border border-border bg-card p-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Add up to {maxItems} items at once. You can add more anytime.
        </p>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {items.map((item, index) => (
          <div
            key={item.id}
            className="border border-border rounded-lg overflow-hidden bg-background hover:border-primary transition-colors"
          >
            {/* Item Header */}
            <button
              onClick={() => toggleExpanded(item.id)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3 flex-1 text-left">
                <span className="text-sm font-medium text-muted-foreground w-6 text-center">
                  {index + 1}
                </span>
                <span className="text-sm font-medium text-foreground truncate">
                  {item.name || "Enter name..."}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeItem(item.id);
                  }}
                  disabled={items.length === 1}
                  className="p-1.5 hover:bg-destructive/10 text-destructive rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Remove item"
                >
                  <FiX size={18} />
                </button>
                <FiChevronDown
                  size={18}
                  className={`text-muted-foreground transition-transform ${
                    expandedItems.has(item.id) ? "rotate-180" : ""
                  }`}
                />
              </div>
            </button>

            {/* Item Expanded Content */}
            {expandedItems.has(item.id) && (
              <div className="border-t border-border px-4 py-3 bg-muted/30 space-y-3">
                {fields.map((field) => (
                  <div key={field.name}>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      {field.label}
                      {field.required && <span className="text-destructive ml-1">*</span>}
                    </label>
                    {field.type === "select" ? (
                      <select
                        value={item[field.name] || ""}
                        onChange={(e) =>
                          updateItem(item.id, field.name, e.target.value)
                        }
                        className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="">{field.placeholder || "Select..."}</option>
                        {field.options?.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    ) : field.type === "number" ? (
                      <input
                        type="number"
                        value={item[field.name] || ""}
                        onChange={(e) =>
                          updateItem(item.id, field.name, e.target.value)
                        }
                        placeholder={field.placeholder}
                        className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        min="0"
                      />
                    ) : (
                      <input
                        type="text"
                        value={item[field.name] || ""}
                        onChange={(e) =>
                          updateItem(item.id, field.name, e.target.value)
                        }
                        placeholder={field.placeholder}
                        className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    )}
                    {field.helpText && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {field.helpText}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add More Button */}
      {items.length < maxItems && (
        <button
          onClick={addItem}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-dashed border-primary text-primary hover:bg-primary/5 rounded-lg transition-colors"
        >
          <FiPlus size={18} />
          <span className="text-sm font-medium">Add Another Item</span>
        </button>
      )}

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={!isValid || isLoading}
        className="w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <span className="animate-spin">⟳</span>
            <span>Processing...</span>
          </>
        ) : (
          <>
            <FiPlus size={18} />
            <span>{submitLabel}</span>
          </>
        )}
      </button>
    </div>
  );
}
