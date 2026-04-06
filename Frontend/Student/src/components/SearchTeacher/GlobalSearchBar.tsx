'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSubjectSearchSuggestions } from '@/lib/hooks/useAcademics';
import { SubjectWithContext } from '@/components/types';
import { SuggestionListSkeleton } from './SkeletonLoaders';

interface GlobalSearchBarProps {
  onSubjectSelect?: (subject: SubjectWithContext) => void;
}

const GlobalSearchBar: React.FC<GlobalSearchBarProps> = ({ onSubjectSelect }) => {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Debounce search query
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 1000);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [searchQuery]);

  // Fetch suggestions
  const { data: suggestions = [], isLoading, error } = useSubjectSearchSuggestions(
    debouncedQuery,
    true
  );

  // Handle click outside
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

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSuggestions]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setShowSuggestions(true);
  };

  const handleSuggestionClick = (subject: SubjectWithContext) => {
    setSearchQuery('');
    setShowSuggestions(false);

    if (onSubjectSelect) {
      onSubjectSelect(subject);
    } else {
      // Default navigation to teacher search with subject filter
      const params = new URLSearchParams({
        subject_id: subject.id,
        subject_name: subject.name,
      });
      router.push(`/search-teacher?${params.toString()}`);
    }
  };

  return (
    <div className="mb-8">
      <div className="relative" ref={suggestionsRef}>
        <div className="relative group">
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            onFocus={() => setShowSuggestions(true)}
            placeholder="Search subjects... (e.g., Mathematics, Physics)"
            className="w-full bg-surface border border-border rounded-2xl px-5 py-4 text-sm font-semibold focus:border-primary outline-none transition-all placeholder:text-muted-foreground/40"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setShowSuggestions(false);
              }}
              className="absolute right-5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Suggestions Dropdown */}
        {showSuggestions && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-surface border border-border rounded-2xl shadow-xl z-50 max-h-96 overflow-y-auto">
            {isLoading && debouncedQuery ? (
              <div className="p-4">
                <SuggestionListSkeleton count={3} />
              </div>
            ) : error ? (
              <div className="p-4 text-center text-destructive text-sm">
                Failed to load suggestions
              </div>
            ) : suggestions.length > 0 ? (
              <div className="divide-y divide-border">
                {suggestions.map((subject) => (
                  <div
                    key={subject.id}
                    onClick={() => handleSuggestionClick(subject)}
                    className="px-4 py-3 hover:bg-subtle cursor-pointer transition-colors border-b border-border last:border-b-0"
                  >
                    <div className="flex flex-col gap-1">
                      <p className="font-semibold text-foreground">{subject.name}</p>
                      <p className="text-xs text-muted-foreground">{subject.full_context}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : debouncedQuery ? (
              <div className="p-4 text-center text-muted-foreground text-sm">
                No subjects found matching &quot;{debouncedQuery}&quot;
              </div>
            ) : (
              <div className="p-4 text-center text-muted-foreground text-sm">
                Type to search for subjects
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default GlobalSearchBar;
