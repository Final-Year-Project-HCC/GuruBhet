'use client';

import React, { ReactNode } from 'react';

export interface TabItem {
  id: string;
  label: string;
  description?: string;
  icon?: ReactNode;
}

interface TabNavigationLayoutProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  children: ReactNode;
}

/**
 * A reusable tab navigation layout component that supports sidebar/tabbed navigation
 * with consistent styling using CSS variables.
 */
export function TabNavigationLayout({
  tabs,
  activeTab,
  onTabChange,
  children,
}: TabNavigationLayoutProps) {
  return (
    <div className="flex flex-col md:flex-row gap-6 min-h-screen">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-48 shrink-0">
        <nav className="space-y-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`w-full text-left px-4 py-3 rounded-md transition-colors font-medium ${
                activeTab === tab.id
                  ? 'bg-muted text-primary border-l-4 border-primary'
                  : 'text-muted-foreground hover:bg-muted/50'
              }`}
            >
              <div className="flex items-center gap-2">
                {tab.icon}
                <div>
                  <div className="text-sm font-semibold">{tab.label}</div>
                  {tab.description && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {tab.description}
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
