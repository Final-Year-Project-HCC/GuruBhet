'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import GlobalSearchBar from '@/components/SearchTeacher/GlobalSearchBar';
import HierarchicalSidebar from '@/components/SearchTeacher/HierarchicalSidebar';
import SearchFilterBar from '@/components/SearchTeacher/SearchFilterBar';
import TeacherResultCard from '@/components/SearchTeacher/TeacherResultCard';
import { TeacherSearchResult, Subject } from '@/lib/types';
import {
  useTeachersBySubject,
  TeacherSearchFilters,
} from '@/hooks/useAcademics';
import { TeacherCardSkeletonGrid } from '@/components/SearchTeacher/SkeletonLoaders';

// ─── Types ───────────────────────────────────────────────────────────────────

type SearchMode = 'search-bar' | 'sidebar' | null;

// ─── Empty state ─────────────────────────────────────────────────────────────

const EmptyState: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-24 text-center">
    <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-6">
      <svg
        className="w-10 h-10 text-muted-foreground/40"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
    </div>
    <h3 className="text-xl font-black text-foreground mb-2">Start your search</h3>
    <p className="text-muted-foreground text-sm max-w-xs leading-relaxed">
      Use the search bar above to find a subject by name, or drill down through the
      hierarchy on the left to find your exact course.
    </p>
  </div>
);

// ─── No results state ────────────────────────────────────────────────────────

const NoResults: React.FC<{ subjectName: string; onNewSearch: () => void }> = ({
  subjectName,
  onNewSearch,
}) => (
  <div className="flex flex-col items-center justify-center py-24 text-center">
    <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-6">
      <svg
        className="w-10 h-10 text-muted-foreground/40"
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
    </div>
    <h3 className="text-xl font-black text-foreground mb-2">No teachers found</h3>
    <p className="text-muted-foreground text-sm mb-6 max-w-xs leading-relaxed">
      No verified teachers are available for <span className="font-bold text-foreground">{subjectName}</span> with
      the selected filters. Try relaxing your filters or searching a different subject.
    </p>
    <button
      onClick={onNewSearch}
      className="bg-primary text-primary-foreground px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-primary/90 active:scale-95 transition-all"
    >
      New Search
    </button>
  </div>
);

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SearchTeacherPage() {
  const router = useRouter();

  // Active search state
  const [activeSubject, setActiveSubject] = useState<Subject | null>(null);
  const [activeSearchMode, setActiveSearchMode] = useState<SearchMode>(null);
  const [filters, setFilters] = useState<TeacherSearchFilters>({});

  // Keys to force remount/reset of search components when the other is used
  const [globalSearchKey, setGlobalSearchKey] = useState(0);
  const [sidebarKey, setSidebarKey] = useState(0);

  // Fetch teachers from backend when a subject is selected
  const {
    data: teachers = [],
    isLoading: teachersLoading,
    isFetching,
  } = useTeachersBySubject(activeSubject?.id ?? null, filters);

  const hasSearched = activeSubject !== null;
  const isResultsLoading = teachersLoading || isFetching;

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleSearchBarSelect = useCallback((subject: Subject) => {
    setActiveSubject(subject);
    setActiveSearchMode('search-bar');
    setFilters({});
  }, []);

  /** Called when the user clears or edits the search bar — resets results */
  const handleSearchBarClear = useCallback(() => {
    setActiveSubject(null);
    setActiveSearchMode(null);
    setFilters({});
  }, []);

  const handleSidebarTeachersFound = useCallback(
    (_teachers: TeacherSearchResult[], subject: Subject) => {
      setActiveSubject(subject);
      setActiveSearchMode('sidebar');
      setFilters({});
    },
    []
  );

  const handleFiltersChange = useCallback((newFilters: TeacherSearchFilters) => {
    setFilters(newFilters);
  }, []);

  const handleNewSearch = useCallback(() => {
    setActiveSubject(null);
    setActiveSearchMode(null);
    setFilters({});
  }, []);

  const handleGlobalSearchInteraction = useCallback(() => {
    setActiveSubject(null);
    setActiveSearchMode(null);
    setSidebarKey(k => k + 1);
  }, []);

  const handleSidebarInteraction = useCallback(() => {
    setActiveSubject(null);
    setActiveSearchMode(null);
    setGlobalSearchKey(k => k + 1);
  }, []);

  const handleViewProfile = useCallback(
    (teacherId: string) => {
      router.push(`/teacher-profile/${teacherId}`);
    },
    [router]
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="bg-background min-h-screen">
      <div className="max-w-7xl mx-auto px-4 pt-10 pb-24">

        {/* ── Page Header ─────────────────────────────────────────────────── */}
        <div className="mb-10">
          <h1 className="text-4xl font-black tracking-tight text-foreground mb-2">
            Find Your Tutor
          </h1>
          <p className="text-muted-foreground text-sm">
            Search by subject name, or use the hierarchy on the left to narrow down your exact course.
          </p>
        </div>

        {/* ── Search Bar — ALWAYS VISIBLE ──────────────────────────────────── */}
        <div className={`mb-10 ${hasSearched ? 'pb-5' : ''}`}>
          <GlobalSearchBar
            key={`global-search-${globalSearchKey}`}
            onSubjectSelect={handleSearchBarSelect}
            onClear={handleSearchBarClear}
            selectedSubjectName={
              activeSearchMode === 'search-bar' ? (activeSubject?.name ?? undefined) : undefined
            }
            onInteraction={handleGlobalSearchInteraction}
          />
        </div>

        {/* ── Main Layout ─────────────────────────────────────────────────── */}
        <div className="flex flex-col lg:flex-row gap-8 items-start">

          {/* ── Left: Sidebar ── */}
          <aside className="w-full lg:w-72 shrink-0">
            <HierarchicalSidebar
              key={`sidebar-${sidebarKey}`}
              onTeachersFound={handleSidebarTeachersFound}
              hideInlineResults
              onInteraction={handleSidebarInteraction}
            />
          </aside>

          {/* ── Right: Results ── */}
          <div className="flex-1 min-w-0">

            {/* Post-search: filter bar */}
            {hasSearched && (
              <SearchFilterBar
                filters={filters}
                onFiltersChange={handleFiltersChange}
                resultCount={teachers.length}
                isLoading={isResultsLoading}
                subjectName={activeSubject?.name}
                onNewSearch={handleNewSearch}
              />
            )}

            {/* Loading skeleton */}
            {hasSearched && isResultsLoading && (
              <TeacherCardSkeletonGrid count={6} />
            )}

            {/* Teacher result cards */}
            {hasSearched && !isResultsLoading && teachers.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {teachers.map((teacher) => (
                  <TeacherResultCard
                    key={teacher.teacherId}
                    teacher={teacher}
                    onViewProfile={handleViewProfile}
                  />
                ))}
              </div>
            )}

            {/* No results */}
            {hasSearched && !isResultsLoading && teachers.length === 0 && (
              <NoResults
                subjectName={activeSubject?.name ?? ''}
                onNewSearch={handleNewSearch}
              />
            )}

            {/* Initial empty state */}
            {!hasSearched && <EmptyState />}

          </div>
        </div>
      </div>
    </div>
  );
}
