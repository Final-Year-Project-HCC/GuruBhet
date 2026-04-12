'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useDebounce } from 'use-debounce';
import { useSubjectSearchSuggestions } from '@/lib/hooks/useAcademics';
import { SubjectWithContext } from '@/components/types';
import { SuggestionListSkeleton } from './SkeletonLoaders';

interface GlobalSearchBarProps {
  onSubjectSelect: (subject: SubjectWithContext) => void;
}

const GlobalSearchBar: React.FC<GlobalSearchBarProps> = ({ onSubjectSelect }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [debouncedQuery] = useDebounce(searchQuery, 400);

  const { data: suggestions = [], isLoading, error } = useSubjectSearchSuggestions(
    debouncedQuery,
    true
  );

  // Reset highlighted index when suggestions change
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [suggestions]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    if (showSuggestions) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSuggestions]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setShowSuggestions(true);
  };

  const handleSuggestionClick = useCallback((subject: SubjectWithContext) => {
    setSearchQuery(subject.name);
    setShowSuggestions(false);
    onSubjectSelect(subject);
  }, [onSubjectSelect]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      e.preventDefault();
      handleSuggestionClick(suggestions[highlightedIndex]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const handleClear = () => {
    setSearchQuery('');
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  return (
    <div className="relative" ref={suggestionsRef}>
      <div className="relative group">
        {/* Search Icon */}
        <div className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground/50 pointer-events-none">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={handleSearchChange}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search by subject name, e.g. Mathematics, Physics, Nepali..."
          className="w-full bg-surface border-2 border-border rounded-2xl pl-13 pr-12 py-4 text-sm font-semibold focus:border-primary outline-none transition-all placeholder:text-muted-foreground/40"
          aria-autocomplete="list"
          aria-expanded={showSuggestions}
          role="combobox"
        />

        {/* Clear Button / Spinner */}
        <div className="absolute right-5 top-1/2 -translate-y-1/2">
          {isLoading && debouncedQuery ? (
            <svg className="w-4 h-4 animate-spin text-muted-foreground" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : searchQuery ? (
            <button
              onClick={handleClear}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear search"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ) : null}
        </div>
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && (searchQuery.length > 0 || debouncedQuery.length > 0) && (
        <div
          className="absolute top-full left-0 right-0 mt-2 bg-surface border border-border rounded-2xl shadow-2xl z-50 max-h-80 overflow-y-auto"
          role="listbox"
        >
          {isLoading && debouncedQuery ? (
            <div className="p-4">
              <SuggestionListSkeleton count={3} />
            </div>
          ) : error ? (
            <div className="p-4 text-center text-destructive text-sm">
              Failed to load suggestions
            </div>
          ) : suggestions.length > 0 ? (
            <div>
              {suggestions.map((subject, idx) => (
                <div
                  key={subject.id}
                  role="option"
                  aria-selected={highlightedIndex === idx}
                  onMouseDown={() => handleSuggestionClick(subject)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={`px-5 py-3.5 cursor-pointer transition-colors border-b border-border last:border-b-0 ${
                    highlightedIndex === idx
                      ? 'bg-muted'
                      : 'hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0 text-muted-foreground/40">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground text-sm truncate">{subject.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{subject.fullContext}</p>
                    </div>
                    <div className="shrink-0 text-muted-foreground/30">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : debouncedQuery && !isLoading ? (
            <div className="p-6 text-center text-muted-foreground text-sm">
              <svg className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              No subjects found for &quot;{debouncedQuery}&quot;
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default GlobalSearchBar;
