'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api';
import Link from 'next/link';
import type { TeacherProfileResponse, TeacherAcademicSubject } from '@/lib/types';

export default function PublicProfile() {
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch teacher profile
  const {
    data: profile,
    isLoading: isLoadingProfile,
    error: profileError,
  } = useQuery<TeacherProfileResponse>({
    queryKey: ['myPublicProfile'],
    queryFn: async () => {
      const response = await apiClient.get('/teachers/me');
      return response.data.data;
    },
  });

  // Fetch teacher subjects separately
  const {
    data: subjects = [],
    isLoading: isLoadingSubjects,
    error: subjectsError,
  } = useQuery<TeacherAcademicSubject[]>({
    queryKey: ['teacherPublicSubjects'],
    queryFn: async () => {
      const response = await apiClient.get('/teachers/me/subjects');
      return response.data.data || [];
    },
    enabled: !!profile?.userId, // Only fetch after profile loads
  });

  const isLoadingProfile_combined = isLoadingProfile || isLoadingSubjects;
  const hasError = profileError || subjectsError;

  if (isLoadingProfile_combined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="text-lg text-muted-foreground">Loading your public profile...</div>
        </div>
      </div>
    );
  }

  if (hasError || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="text-lg text-destructive">Failed to load your public profile</div>
          <Link href="/account" className="text-primary hover:underline mt-2 inline-block">
            Return to Account Settings
          </Link>
        </div>
      </div>
    );
  }

  // Filter subjects based on search
  const filteredSubjects = subjects.filter((ts: TeacherAcademicSubject) =>
    ts.subject.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ts.subject.board.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ts.subject.faculty.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getUnitTypeLabel = (unitType: string) => {
    switch (unitType) {
      case 'SEMESTER':
        return 'Semester';
      case 'YEAR':
        return 'Year';
      case 'GRADE':
        return 'Grade';
      default:
        return unitType;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Back */}
      <div className="border-b border-border py-4 px-4">
        <Link href="/account" className="text-primary hover:underline text-sm font-medium">
          ← Back to Account Settings
        </Link>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Left Column - Bio Card (Sticky) */}
          <div className="lg:col-span-1">
            <div className="sticky top-8 space-y-6">
              {/* Profile Card */}
              <div className="bg-muted rounded-2xl p-6 space-y-4">
                {/* Profile Image */}
                <div className="flex justify-center">
                  <div className="w-32 h-32 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-primary">
                    {profile?.avatarUrl ? (
                      <img
                        src={profile.avatarUrl}
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-4xl font-bold text-primary">
                        T
                      </div>
                    )}
                  </div>
                </div>

                {/* Teacher Info */}
                <div className="text-center space-y-1">
                  <h1 className="text-2xl font-bold">
                    {profile?.headline || 'Teacher Profile'}
                  </h1>
                  {profile?.verificationStatus === 'APPROVED' && (
                    <div className="flex items-center justify-center gap-1 text-primary text-sm font-medium">
                      <span>✓</span> Verified Teacher
                    </div>
                  )}
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-border">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-foreground">
                      N/A
                    </div>
                    <div className="text-xs text-muted-foreground">Rating</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-foreground">
                      0
                    </div>
                    <div className="text-xs text-muted-foreground">Sessions</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-foreground">
                      {subjects.length > 0 
                        ? Math.max(...subjects.map(s => s.yearsOfExperience))
                        : 'N/A'}
                    </div>
                    <div className="text-xs text-muted-foreground">Years Exp</div>
                  </div>
                </div>

                {/* About Section */}
                {profile?.bio && (
                  <div className="pt-4 space-y-2 border-t border-border">
                    <h3 className="font-semibold text-sm">About</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{profile.bio}</p>
                  </div>
                )}

                {/* Expertise Tags */}
                {subjects.length > 0 && (
                  <div className="pt-4 space-y-2 border-t border-border">
                    <h3 className="font-semibold text-sm">Expertise</h3>
                    <div className="flex flex-wrap gap-2">
                      {/* Show unique faculties */}
                      {Array.from(
                        new Set(subjects.map((ts) => ts.subject.faculty.name))
                      )
                        .slice(0, 5)
                        .map((faculty) => (
                          <span
                            key={faculty}
                            className="px-3 py-1 bg-muted text-foreground rounded-full text-xs font-medium border border-border"
                          >
                            {faculty}
                          </span>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Content (3/4 width) */}
          <div className="lg:col-span-3 space-y-8">
            {/* Teaching Catalog Header */}
            <div>
              <h2 className="text-3xl font-bold mb-6">Teaching Catalog</h2>

              {/* Search Bar */}
              <div className="mb-6">
                <input
                  type="text"
                  placeholder="Search subjects, boards, faculties..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-3 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Subject Cards Grid */}
              {filteredSubjects.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">
                    {subjects.length === 0
                      ? 'No subjects added yet'
                      : 'No subjects match your search'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredSubjects.map((ts: TeacherAcademicSubject) => (
                    <div
                      key={ts.subjectId}
                      className="border border-border rounded-xl overflow-hidden hover:shadow-lg transition-shadow bg-muted"
                    >
                      {/* Card Header */}
                      <div className="bg-primary text-primary-foreground p-4">
                        <h3 className="text-lg font-bold mb-2">{ts.subject.name}</h3>
                        <div className="flex flex-wrap gap-2">
                          <span className="px-2 py-1 bg-primary-foreground/20 rounded text-xs font-medium">
                            {ts.subject.studyLevel.name}
                          </span>
                          <span className="px-2 py-1 bg-primary-foreground/20 rounded text-xs font-medium">
                            {ts.subject.board.name}
                          </span>
                          <span className="px-2 py-1 bg-primary-foreground/20 rounded text-xs font-medium">
                            {ts.subject.faculty.name}
                          </span>
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className="p-4 space-y-4">
                        {/* Unit Information */}
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="text-xs text-muted-foreground font-medium">
                              Unit:
                            </div>
                            <div className="font-semibold">
                              {getUnitTypeLabel(ts.subject.faculty.unitType)} {ts.subject.unitValue}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-muted-foreground font-medium">
                              Rate:
                            </div>
                            <div className="font-bold text-primary text-lg">
                              Rs. {ts.ratePerSession}
                            </div>
                          </div>
                        </div>

                        {/* Stats Row */}
                        <div className="grid grid-cols-3 gap-2 py-3 border-y border-border">
                          <div className="text-center">
                            <div className="text-xs text-muted-foreground">Rating</div>
                            <div className="font-semibold">
                              {ts.avgRating ? ts.avgRating.toFixed(1) : 'N/A'}
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-xs text-muted-foreground">Sessions</div>
                            <div className="font-semibold">{ts.totalSessionsCompleted}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-xs text-muted-foreground">Exp</div>
                            <div className="font-semibold">{ts.yearsOfExperience}y</div>
                          </div>
                        </div>

                        {/* Experience Badge */}
                        <div className="text-center pt-2">
                          <span className="px-3 py-1 bg-muted text-foreground rounded-full text-xs font-medium border border-border">
                            {ts.yearsOfExperience}+ years teaching experience
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Reviews Section (Placeholder) */}
            <div className="border-t border-border pt-8">
              <h2 className="text-2xl font-bold mb-6">Recent Reviews</h2>
              <div className="text-center py-12 bg-muted rounded-lg">
                <p className="text-muted-foreground">Reviews from students will appear here</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
