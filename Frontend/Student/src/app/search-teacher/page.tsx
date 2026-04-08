'use client';

import React, { useState } from 'react';
import GlobalSearchBar from '@/components/SearchTeacher/GlobalSearchBar';
import HierarchicalSidebar from '@/components/SearchTeacher/HierarchicalSidebar';
import { TeacherSearchResult, SubjectWithContext, Subject } from '@/components/types';
import { useRouter } from 'next/navigation';

export default function SearchTeacherPage() {
  const router = useRouter();
  const [teachersFromSearch, setTeachersFromSearch] = useState<TeacherSearchResult[]>([]);
  const [teachersFromSidebar, setTeachersFromSidebar] = useState<TeacherSearchResult[]>([]);
  const [selectedSubjectFromSearch, setSelectedSubjectFromSearch] = useState<SubjectWithContext | null>(
    null
  );
  const [selectedSubjectFromSidebar, setSelectedSubjectFromSidebar] = useState<Subject | null>(null);

  const handleGlobalSearchSelect = (subject: SubjectWithContext) => {
    setSelectedSubjectFromSearch(subject);
    // Navigate to teacher profile or show teachers for this subject
    router.push(
      `/search-teacher?subjectId=${subject.id}&subjectName=${encodeURIComponent(subject.name)}`
    );
  };

  const handleSidebarTeachersFound = (teachers: TeacherSearchResult[], subject: Subject) => {
    setTeachersFromSidebar(teachers);
    setSelectedSubjectFromSidebar(subject);
  };

  return (
    <div className="bg-surface-muted min-h-screen pt-12 pb-24">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">Find Your Tutor</h1>
          <p className="text-muted-foreground">Search for qualified teachers in your subject area</p>
        </div>

        {/* Global Search Bar */}
        <div className="mb-12">
          <GlobalSearchBar onSubjectSelect={handleGlobalSearchSelect} />
        </div>

        {/* Main Layout: Sidebar + Results */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar Filter */}
          <div className="lg:col-span-1">
            <HierarchicalSidebar onTeachersFound={handleSidebarTeachersFound} />
          </div>

          {/* Results Area */}
          <div className="lg:col-span-3">
            {selectedSubjectFromSearch && (
              <div className="bg-surface border border-border rounded-2xl p-6 shadow-lg">
                <h2 className="text-2xl font-bold text-foreground mb-4">
                  Teachers for: {selectedSubjectFromSearch.name}
                </h2>
                <p className="text-sm text-muted-foreground mb-6">
                  {selectedSubjectFromSearch.fullContext}
                </p>
                <p className="text-center text-muted-foreground py-12">
                  Teacher search results would load here based on the subject selection
                </p>
              </div>
            )}

            {selectedSubjectFromSidebar && teachersFromSidebar.length === 0 && (
              <div className="bg-surface border border-border rounded-2xl p-6 shadow-lg text-center">
                <p className="text-muted-foreground">
                  No teachers available for {selectedSubjectFromSidebar.name}
                </p>
              </div>
            )}

            {!selectedSubjectFromSearch && !selectedSubjectFromSidebar && (
              <div className="bg-subtle border border-border rounded-2xl p-12 text-center">
                <svg
                  className="w-16 h-16 mx-auto mb-4 text-muted-foreground/40"
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
                <p className="text-muted-foreground">
                  Use the search bar or filters above to find your tutor
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
