'use client';

import React from 'react';
import { TeacherSearchFilters } from '@/hooks/useAcademics';

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
  onNewSearch,
}) => {
  const activeRating = filters.minRating ?? 0;
  const hasActiveFilters =
    activeRating > 0 ||
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
    <div className="bg-surface border border-border rounded-2xl px-4 py-3 shadow-sm mb-6">
      <div className="flex flex-wrap items-center gap-3">

        {/* ── Result count pill ── */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Results
          </span>
          <span
            className={`min-w-[2rem] text-center bg-primary text-primary-foreground text-xs font-black px-2.5 py-0.5 rounded-full transition-all ${isLoading ? 'opacity-40' : 'opacity-100'
              }`}
          >
            {isLoading ? '…' : resultCount}
          </span>
        </div>

        {/* ── Divider ── */}
        <div className="h-5 w-px bg-border shrink-0" />

        {/* ── Rating filter label ── */}
        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground shrink-0">
          ★ Min Rating
        </span>

        {/* ── Rating pills — numeric only ── */}
        <div className="flex items-center gap-1 flex-wrap">
          {RATING_OPTIONS.map((opt) => {
            const isActive = activeRating === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => handleRatingChange(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 select-none border ${isActive
                  ? 'bg-rating-bg text-rating border-rating/30 shadow-sm scale-105'
                  : 'bg-muted text-muted-foreground border-transparent hover:border-border hover:text-foreground'
                  }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* ── Divider ── */}
        <div className="h-5 w-px bg-border shrink-0" />

        {/* ── Price range ── */}
        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground shrink-0">
          Price (NPR)
        </span>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            value={filters.minRate ?? ''}
            onChange={handleMinPriceChange}
            placeholder="Min"
            min={0}
            className="w-20 bg-muted border border-border rounded-lg px-2.5 py-1.5 text-xs font-bold outline-none focus:border-primary transition-all placeholder:text-muted-foreground/40 text-center"
          />
          <span className="text-muted-foreground/40 text-xs font-bold">—</span>
          <input
            type="number"
            value={filters.maxRate ?? ''}
            onChange={handleMaxPriceChange}
            placeholder="Max"
            min={0}
            className="w-20 bg-muted border border-border rounded-lg px-2.5 py-1.5 text-xs font-bold outline-none focus:border-primary transition-all placeholder:text-muted-foreground/40 text-center"
          />
        </div>

        {/* ── Spacer + actions ── */}
        <div className="ml-auto flex items-center gap-2 shrink-0">
          {hasActiveFilters && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-destructive transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Reset
            </button>
          )}
        </div>

      </div>
    </div>
  );
};

export default SearchFilterBar;
