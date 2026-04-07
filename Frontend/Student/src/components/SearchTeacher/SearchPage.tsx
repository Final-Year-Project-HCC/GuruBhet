
"use client";

import React, { useState, useMemo } from 'react';
import { TRENDING_TEACHERS, RECOMMENDED_TEACHERS } from '../constants';
import { SubjectLevel } from '../types';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import FilterBar from './FilterBar';
import ResultsHeader from './ResultsHeader';
import TutorResults from './TutorResults';

interface SearchPageProps {
  onViewProfile: (id: string) => void;
}

const SearchPage: React.FC<SearchPageProps> = ({ onViewProfile }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<SubjectLevel | 'All'>('All');
  const [maxPrice, setMaxPrice] = useState<number>(2000);
  const [sortBy, setSortBy] = useState<'rating' | 'price-low' | 'price-high'>('rating');
  const requireAuth = useRequireAuth();

  const allTeachers = useMemo(() => {
    const combined = [...TRENDING_TEACHERS, ...RECOMMENDED_TEACHERS];
    return Array.from(new Map(combined.map((item) => [item.id, item])).values());
  }, []);

  const filteredTeachers = useMemo(() => {
    return allTeachers
      .filter((t) => {
        const matchesSearch =
          t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (t.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
        const matchesLevel =
          selectedLevel === 'All' || (t.levelExpertise?.includes(selectedLevel as SubjectLevel) ?? false);
        const matchesPrice = (t.ratePerSession ?? Infinity) <= maxPrice;
        return matchesSearch && matchesLevel && matchesPrice;
      })
      .sort((a, b) => {
        if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
        if (sortBy === 'price-low') return (a.ratePerSession || Infinity) - (b.ratePerSession || Infinity);
        if (sortBy === 'price-high') return (b.ratePerSession || 0) - (a.ratePerSession || 0);
        return 0;
      });
  }, [allTeachers, searchTerm, selectedLevel, maxPrice, sortBy]);

  // Handlers
  const handleMessage = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    requireAuth(() => {});
  };

  const handleReset = () => {
    setSearchTerm('');
    setSelectedLevel('All');
    setMaxPrice(2000);
    setSortBy('rating');
  };

  return (
    <div className="bg-surface-muted min-h-screen">
      <div className="max-w-7xl mx-auto px-4 pt-12 pb-24">
        <FilterBar
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          selectedLevel={selectedLevel}
          setSelectedLevel={setSelectedLevel}
          maxPrice={maxPrice}
          setMaxPrice={setMaxPrice}
          sortBy={sortBy}
          setSortBy={setSortBy}
          onReset={handleReset}
        />

        <ResultsHeader count={filteredTeachers.length} />

        <TutorResults
          teachers={filteredTeachers}
          onMessage={handleMessage}
          onViewProfile={onViewProfile}
          onReset={handleReset}
        />
      </div>
    </div>
  );
};

export default SearchPage;
