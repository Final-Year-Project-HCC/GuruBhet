'use client';

import React from 'react';

export const DropdownSkeleton: React.FC = () => {
  return (
    <div className="w-full">
      <div className="h-14 bg-muted rounded-2xl animate-pulse"></div>
    </div>
  );
};

export const SearchInputSkeleton: React.FC = () => {
  return (
    <div className="w-full">
      <div className="h-14 bg-muted rounded-2xl animate-pulse"></div>
    </div>
  );
};

export const SuggestionListSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-12 bg-muted rounded-xl"></div>
      ))}
    </div>
  );
};

export const TeacherCardSkeleton: React.FC = () => {
  return (
    <div className="bg-surface border border-border rounded-2xl p-4 animate-pulse">
      <div className="flex gap-4 mb-4">
        <div className="w-16 h-16 bg-muted rounded-full shrink-0"></div>
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-muted rounded w-3/4"></div>
          <div className="h-3 bg-muted rounded w-1/2"></div>
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-muted rounded w-full"></div>
        <div className="h-3 bg-muted rounded w-3/4"></div>
      </div>
    </div>
  );
};

export const TeacherCardSkeletonGrid: React.FC<{ count?: number }> = ({ count = 6 }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <TeacherCardSkeleton key={i} />
      ))}
    </div>
  );
};

export const HierarchicalSidebarSkeleton: React.FC = () => {
  return (
    <div className="bg-surface border border-border rounded-2xl p-6 shadow-lg animate-pulse">
      <div className="h-6 bg-muted rounded w-1/2 mb-6"></div>
      <div className="space-y-6">
        {/* Level 1 */}
        <div>
          <div className="h-2 bg-muted rounded w-1/3 mb-3"></div>
          <div className="h-14 bg-muted rounded-2xl"></div>
        </div>
        {/* Level 2 */}
        <div>
          <div className="h-2 bg-muted rounded w-1/3 mb-3"></div>
          <div className="h-14 bg-muted rounded-2xl"></div>
        </div>
        {/* Level 3 */}
        <div>
          <div className="h-2 bg-muted rounded w-1/3 mb-3"></div>
          <div className="h-14 bg-muted rounded-2xl"></div>
        </div>
        {/* Level 4 */}
        <div>
          <div className="h-2 bg-muted rounded w-1/3 mb-3"></div>
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 bg-muted rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
