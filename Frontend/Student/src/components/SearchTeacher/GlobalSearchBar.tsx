'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useDebounce } from 'use-debounce';
import { useSubjectSearchSuggestions } from '@/hooks/useAcademics';
import { Subject } from '@/lib/types';

interface GlobalSearchBarProps {
  onSubjectSelect: (subject: Subject) => void;
  /** When a subject is already selected, this fills the input and prevents re-querying */
  selectedSubjectName?: string;
  /** Called when the user clears or changes the query — signals parent to reset */
  onClear?: () => void;
}

const GlobalSearchBar: React.FC<GlobalSearchBarProps> = ({
  onSubjectSelect,
  selectedSubjectName,
  onClear,
}) => {
  const [searchQuery, setSearchQuery] = useState(selectedSubjectName ?? '');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  // Tracks the pixel rect of the input so the portal can position itself
  const [dropdownRect, setDropdownRect] = useState<DOMRect | null>(null);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);

  // Ensure portal only renders client-side
  useEffect(() => { setMounted(true); }, []);

  // Sync input when parent changes the selected subject name
  useEffect(() => {
    setSearchQuery(selectedSubjectName ?? '');
    setShowSuggestions(false);
  }, [selectedSubjectName]);

  const isSubjectSelected = !!selectedSubjectName;
  const [debouncedQuery] = useDebounce(searchQuery, 350);
  const queryToSearch = isSubjectSelected ? '' : debouncedQuery;

  const { data: suggestions = [], isLoading, isFetching } = useSubjectSearchSuggestions(
    queryToSearch,
    !isSubjectSelected && queryToSearch.length > 0
  );

  // Stable suggestion list — only update when fetch is done to prevent blink
  const [stableSuggestions, setStableSuggestions] = useState<Subject[]>([]);
  useEffect(() => {
    if (!isFetching) setStableSuggestions(suggestions);
  }, [suggestions, isFetching]);

  // Reset highlighted index when list changes
  useEffect(() => { setHighlightedIndex(-1); }, [stableSuggestions]);

  // Update dropdown position whenever it opens or window resizes/scrolls
  const updateRect = useCallback(() => {
    if (wrapperRef.current) {
      setDropdownRect(wrapperRef.current.getBoundingClientRect());
    }
  }, []);

  useEffect(() => {
    if (showSuggestions) {
      updateRect();
      window.addEventListener('resize', updateRect);
      window.addEventListener('scroll', updateRect, true);
    }
    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [showSuggestions, updateRect]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const outsideWrapper = wrapperRef.current && !wrapperRef.current.contains(target);
      // Also check the portal dropdown itself (it is outside wrapperRef in the DOM)
      const portalEl = document.getElementById('gsb-dropdown-portal');
      const outsidePortal = !portalEl || !portalEl.contains(target);
      if (outsideWrapper && outsidePortal) setShowSuggestions(false);
    };
    if (showSuggestions) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSuggestions]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setShowSuggestions(true);
    if (isSubjectSelected && onClear) onClear();
  };

  const handleSuggestionClick = useCallback((subject: Subject) => {
    setSearchQuery(subject.name);
    setShowSuggestions(false);
    onSubjectSelect(subject);
  }, [onSubjectSelect]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || stableSuggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((p) => (p < stableSuggestions.length - 1 ? p + 1 : p));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((p) => (p > 0 ? p - 1 : 0));
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      e.preventDefault();
      handleSuggestionClick(stableSuggestions[highlightedIndex]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const handleClear = () => {
    setSearchQuery('');
    setShowSuggestions(false);
    setStableSuggestions([]);
    inputRef.current?.focus();
    if (onClear) onClear();
  };

  const showDropdown =
    showSuggestions &&
    !isSubjectSelected &&
    (searchQuery.length > 0 || debouncedQuery.length > 0);

  const unitLabel = (subject: Subject) => {
    const type = (subject.faculty?.unitType ?? '').toLowerCase();
    return `${type.charAt(0).toUpperCase()}${type.slice(1)} ${subject.unitValue}`;
  };

  // ── Dropdown content (rendered via portal) ───────────────────────────────

  const dropdownStyle: React.CSSProperties = dropdownRect
    ? {
      position: 'fixed',
      top: dropdownRect.bottom + 8,
      left: dropdownRect.left,
      width: dropdownRect.width,
      zIndex: 9999,
    }
    : { display: 'none' };

  const dropdown = (
    <div id="gsb-dropdown-portal" style={dropdownStyle}>
      <div
        className="bg-surface border border-border rounded-2xl shadow-2xl max-h-[22rem] overflow-y-auto"
        role="listbox"
      >
        {isLoading && stableSuggestions.length === 0 ? (
          /* Loading skeleton */
          <div className="p-3 space-y-1">
            {[1, 2, 3].map((i) => (
              <div key={i} className="px-3 py-3 rounded-xl flex gap-3 items-start">
                <div className="w-8 h-8 rounded-lg bg-muted animate-pulse shrink-0" />
                <div className="flex-1 space-y-2 pt-0.5">
                  <div className="h-3.5 bg-muted animate-pulse rounded-full w-2/5" />
                  <div className="h-2.5 bg-muted animate-pulse rounded-full w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : stableSuggestions.length > 0 ? (
          <div className="p-2">
            {stableSuggestions.map((subject, idx) => {
              const active = highlightedIndex === idx;
              return (
                <div
                  key={subject.id}
                  role="option"
                  aria-selected={active}
                  onMouseDown={() => handleSuggestionClick(subject)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={`flex items-start gap-3 px-3 py-3 rounded-xl cursor-pointer transition-colors ${active ? 'bg-muted' : 'hover:bg-muted/60'
                    }`}
                >
                  {/* Book icon */}
                  <div
                    className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5 transition-colors ${active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                      }`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                      />
                    </svg>
                  </div>

                  {/* Text content */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-foreground text-sm truncate leading-tight">
                      {subject.name}
                    </p>

                    {/* Breadcrumb chips */}
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 mt-1.5">
                      {/* Study level */}
                      <span className="text-[10px] font-bold bg-muted text-muted-foreground px-2 py-0.5 rounded-md uppercase tracking-wide">
                        {subject.studyLevel?.name}
                      </span>

                      <span className="text-muted-foreground/30 text-[10px] select-none">›</span>

                      {/* Board */}
                      <span className="text-[10px] font-semibold text-muted-foreground max-w-[9rem] truncate">
                        {subject.board?.name}
                      </span>

                      {subject.faculty && (
                        <>
                          <span className="text-muted-foreground/30 text-[10px] select-none">›</span>
                          <span className="text-[10px] font-semibold text-muted-foreground max-w-[9rem] truncate">
                            {subject.faculty.name}
                          </span>
                        </>
                      )}

                      <span className="text-muted-foreground/30 text-[10px] select-none">›</span>

                      {/* Unit badge */}
                      <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-md">
                        {unitLabel(subject)}
                      </span>
                    </div>
                  </div>

                  {/* Chevron */}
                  <div
                    className={`shrink-0 self-center transition-colors ${active ? 'text-primary' : 'text-muted-foreground/30'
                      }`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              );
            })}
          </div>
        ) : debouncedQuery && !isLoading ? (
          <div className="p-6 text-center text-muted-foreground text-sm">
            <svg
              className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            No subjects found for &quot;{debouncedQuery}&quot;
          </div>
        ) : null}
      </div>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div ref={wrapperRef} className="relative">
      {/* Input row */}
      <div className="relative">
        {/* Search icon */}
        <div className="absolute left-5 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg
            className={`w-5 h-5 transition-colors ${isSubjectSelected ? 'text-primary' : 'text-muted-foreground/50'
              }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={handleSearchChange}
          onFocus={() => {
            if (!isSubjectSelected) setShowSuggestions(true);
            updateRect();
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search by subject name, e.g. Mathematics, Physics, Nepali..."
          className={`w-full bg-surface border-2 rounded-2xl pl-13 pr-12 py-4 text-sm font-semibold focus:border-primary outline-none transition-all placeholder:text-muted-foreground/40 ${isSubjectSelected
            ? 'border-primary/50 text-foreground'
            : 'border-border text-foreground'
            }`}
          aria-autocomplete="list"
          aria-expanded={showDropdown}
          role="combobox"
        />

        {/* Right slot: spinner or clear button */}
        <div className="absolute right-5 top-1/2 -translate-y-1/2">
          {isLoading && !isSubjectSelected && debouncedQuery ? (
            <svg className="w-4 h-4 animate-spin text-muted-foreground" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
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

      {/* Selected subject pill — floats below the bar */}
      {isSubjectSelected && selectedSubjectName && (
        <div className="absolute top-full left-0 mt-2 flex items-center gap-2 z-10">
          <span className="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-xs font-bold px-3 py-1.5 rounded-full border border-primary/20 shadow-sm">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            {selectedSubjectName}
          </span>
        </div>
      )}

      {/* Dropdown — rendered via portal to escape stacking contexts */}
      {mounted && showDropdown && createPortal(dropdown, document.body)}
    </div>
  );
};

export default GlobalSearchBar;
