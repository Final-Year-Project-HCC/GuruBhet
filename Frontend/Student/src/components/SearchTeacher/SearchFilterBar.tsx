'use client';

import React from 'react';
import { TeacherSearchFilters } from '@/lib/hooks/useAcademics';

interface SearchFilterBarProps {
  filters: TeacherSearchFilters;
  onFiltersChange: (filters: TeacherSearchFilters) => void;
  resultCount: number;
  isLoading: boolean;
  subjectName?: string;
  onNewSearch: () => void;
}

const RATING_OPTIONS = [
  { label: 'Any', value: 0 },
  { label: '3+', value: 3 },
  { label: '3.5+', value: 3.5 },
  { label: '4+', value: 4 },
  { label: '4.5+', value: 4.5 },
];

const SearchFilterBar: React.FC<SearchFilterBarProps> = ({
  filters,
  onFiltersChange,
  resultCount,
  isLoading,
  subjectName,
  onNewSearch,
}) => {
  const hasActiveFilters =
    (filters.minRating ?? 0) > 0 ||
    filters.minRate !== undefined ||
    filters.maxRate !== undefined;

  const handleRatingChange = (value: number) => {
    onFiltersChange({ ...filters, minRating: value === 0 ? undefined : value });
  };

  const handleMinPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value === '' ? undefined : Number(e.target.value);
    onFiltersChange({ ...filters, minRate: val });
  };

  const handleMaxPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value === '' ? undefined : Number(e.target.value);
    onFiltersChange({ ...filters, maxRate: val });
  };

  const handleReset = () => {
    onFiltersChange({ minRating: undefined, minRate: undefined, maxRate: undefined });
  };

  return (
    <div className="bg-surface border border-border rounded-3xl p-6 shadow-sm mb-8">
      <div className="flex flex-col lg:flex-row lg:items-center gap-5">
        {/* Subject context + count */}
        <div className="grow">
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-1">
            Results for
          </p>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-black text-foreground truncate">{subjectName}</h2>
            <span className="shrink-0 bg-primary text-primary-foreground text-xs font-black px-3 py-1 rounded-full">
              {isLoading ? '…' : resultCount}
            </span>
          </div>
        </div>

        {/* Min Rating selector */}
        <div className="shrink-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
            Min Rating
          </p>
          <div className="flex items-center gap-1.5">
            {RATING_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleRatingChange(opt.value)}
                className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  (filters.minRating ?? 0) === opt.value
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : 'bg-muted text-foreground hover:bg-border'
                }`}
              >
                {opt.value > 0 && (
                  <svg className="w-3 h-3 fill-current" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                )}
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Price Range */}
        <div className="shrink-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
            Price Range (NPR)
          </p>
          <div className="flex items-center gap-2">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-muted-foreground">Min</span>
              <input
                type="number"
                value={filters.minRate ?? ''}
                onChange={handleMinPriceChange}
                placeholder="0"
                min={0}
                className="w-24 bg-surface border border-border rounded-xl pl-8 pr-3 py-2 text-sm font-bold outline-none focus:border-primary transition-all text-right"
              />
            </div>
            <span className="text-muted-foreground font-bold text-xs">—</span>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-muted-foreground">Max</span>
              <input
                type="number"
                value={filters.maxRate ?? ''}
                onChange={handleMaxPriceChange}
                placeholder="∞"
                min={0}
                className="w-24 bg-surface border border-border rounded-xl pl-8 pr-3 py-2 text-sm font-bold outline-none focus:border-primary transition-all text-right"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 lg:ml-2 shrink-0">
          {hasActiveFilters && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-destructive transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Reset
            </button>
          )}
          <button
            onClick={onNewSearch}
            className="flex items-center gap-1.5 text-xs font-bold text-primary hover:opacity-70 transition-opacity border border-border rounded-xl px-3 py-2"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            New Search
          </button>
        </div>
      </div>
    </div>
  );
};

export default SearchFilterBar;
