
import React from 'react';
import { SubjectLevel } from '../types';
import { LEVELS } from '../constants';

interface FilterBarProps {
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  selectedLevel: SubjectLevel | 'All';
  setSelectedLevel: (val: SubjectLevel | 'All') => void;
  maxPrice: number;
  setMaxPrice: (val: number) => void;
  sortBy: 'rating' | 'price-low' | 'price-high';
  setSortBy: (val: 'rating' | 'price-low' | 'price-high') => void;
  onReset: () => void;
}

const FilterBar: React.FC<FilterBarProps> = ({
  searchTerm,
  setSearchTerm,
  selectedLevel,
  setSelectedLevel,
  maxPrice,
  setMaxPrice,
  sortBy,
  setSortBy,
  onReset,
}) => {
  return (
    <div className="bg-white border border-border rounded-[2.5rem] p-8 shadow-xl mb-12">
      <div className="flex flex-col lg:flex-row items-end gap-6">
        {/* Search Input */}
        <div className="grow w-full lg:w-auto">
          <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3 px-1">
            Search Name or Subject
          </label>
          <div className="relative group">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="e.g. Physics, Sarah..."
              className="w-full bg-white border border-border rounded-2xl px-5 py-4 text-sm font-semibold focus:border-primary outline-none transition-all placeholder:text-muted-foreground/40"
            />
          </div>
        </div>

        {/* Academic Level */}
        <div className="w-full lg:w-55">
          <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3 px-1">
            Academic Level
          </label>
          <div className="relative">
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value as SubjectLevel | 'All')}
              className="w-full bg-white border border-border rounded-2xl pl-5 pr-10 py-4 text-sm font-semibold focus:border-primary outline-none cursor-pointer appearance-none"
            >
              <option value="All">All Levels</option>
              {LEVELS.map((level) => (
                <option key={level.id} value={level.id}>
                  {level.title}
                </option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground/60">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        {/* Max Price */}
        <div className="w-full lg:w-65">
          <div className="flex justify-between items-center mb-3 px-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Max Price (NPR)
            </label>
            <span className="text-xs font-black text-primary">{maxPrice}</span>
          </div>
          <div className="w-full bg-white border border-border rounded-2xl px-5 h-14.5 flex items-center">
            <input
              type="range"
              min="500"
              max="2500"
              step="100"
              value={maxPrice}
              onChange={(e) => setMaxPrice(parseInt(e.target.value))}
              className="w-full cursor-pointer accent-primary"
            />
          </div>
        </div>

        {/* Sort By */}
        <div className="w-full lg:w-50">
          <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3 px-1">
            Sort By
          </label>
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'rating' | 'price-low' | 'price-high')}
              className="w-full bg-white border border-border rounded-2xl pl-5 pr-10 py-4 text-sm font-semibold focus:border-primary outline-none cursor-pointer appearance-none"
            >
              <option value="rating">Top Rated</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground/60">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        {/* Reset Button */}
        <div className="flex items-center gap-2 mb-4 lg:mb-3">
          <button
            onClick={onReset}
            className="flex items-center gap-2 text-primary hover:text-destructive transition-colors font-bold text-xs"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Reset
          </button>
        </div>
      </div>
    </div>
  );
};

export default FilterBar;
