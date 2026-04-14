'use client';

import React, { useState, useMemo } from 'react';
import {
  useStudyLevels,
  useBoards,
  useFaculties,
  useTeachersBySubject,
  useSubjects,
} from '@/hooks/useAcademics';
import { Subject, TeacherSearchResult } from '@/lib/types';
import { DropdownSkeleton, TeacherCardSkeletonGrid, HierarchicalSidebarSkeleton } from './SkeletonLoaders';

interface HierarchicalSidebarProps {
  onTeachersFound?: (teachers: TeacherSearchResult[], subject: Subject) => void;
  hideInlineResults?: boolean;
  onInteraction?: () => void;
}

const HierarchicalSidebar: React.FC<HierarchicalSidebarProps> = ({ onTeachersFound, hideInlineResults = false, onInteraction }) => {
  // Selected values at each level
  const [selectedStudyLevel, setSelectedStudyLevel] = useState<string | null>(null);
  const [selectedBoard, setSelectedBoard] = useState<string | null>(null);
  const [selectedFaculty, setSelectedFaculty] = useState<string | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<number | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);

  // Fetch data at each level
  const { data: studyLevels = [], isLoading: studyLevelsLoading } = useStudyLevels();
  const { data: boards = [], isLoading: boardsLoading } = useBoards(selectedStudyLevel);
  const { data: faculties = [], isLoading: facultiesLoading } = useFaculties(selectedBoard);
  const { data: allSubjects = [] } = useSubjects(selectedFaculty);

  // Get the selected faculty details
  const selectedFacultyDetails = useMemo(
    () => faculties.find((f) => f.id === selectedFaculty) || null,
    [faculties, selectedFaculty]
  );

  // Generate unit options (1 to totalUnits)
  const unitOptions = useMemo(() => {
    if (!selectedFacultyDetails) return [];
    const options = [];
    for (let i = 1; i <= selectedFacultyDetails.totalUnits; i++) {
      options.push(i);
    }
    return options;
  }, [selectedFacultyDetails]);

  // Get all subjects that belong to the chosen unit
  const unitSubjects = useMemo(() => {
    if (!selectedUnit) return [];
    return allSubjects.filter((s) => s.unitValue === selectedUnit);
  }, [allSubjects, selectedUnit]);

  // Find the exact selected subject chosen by the user
  const selectedSubject = useMemo(() => {
    if (!selectedSubjectId) return null;
    return unitSubjects.find((s) => s.id === selectedSubjectId) || null;
  }, [unitSubjects, selectedSubjectId]);

  // Fetch teachers for the selected subject
  const { data: teachers = [], isLoading: teachersLoading } = useTeachersBySubject(
    selectedSubject?.id || null
  );

  // Reset dependent selections when parent level changes
  const handleStudyLevelChange = (levelId: string) => {
    if (onInteraction) onInteraction();
    setSelectedStudyLevel(levelId);
    setSelectedBoard(null);
    setSelectedFaculty(null);
    setSelectedUnit(null);
  };

  const handleBoardChange = (boardId: string) => {
    if (onInteraction) onInteraction();
    setSelectedBoard(boardId);
    setSelectedFaculty(null);
    setSelectedUnit(null);
  };

  const handleFacultyChange = (facultyId: string) => {
    if (onInteraction) onInteraction();
    setSelectedFaculty(facultyId);
    setSelectedUnit(null);
    setSelectedSubjectId(null);
  };

  const handleUnitChange = (unit: number) => {
    if (onInteraction) onInteraction();
    setSelectedUnit(unit);
    setSelectedSubjectId(null);
  };

  const handleSubjectChange = (subjectId: string) => {
    if (onInteraction) onInteraction();
    setSelectedSubjectId(subjectId);
  };

  // Notify parent when teachers are found
  React.useEffect(() => {
    if (selectedSubject && teachers.length > 0 && onTeachersFound) {
      onTeachersFound(teachers, selectedSubject);
    }
  }, [teachers, selectedSubject, onTeachersFound]);

  const getUnitTypeLabel = () => {
    if (!selectedFacultyDetails) return 'Select Unit';
    const unitType = selectedFacultyDetails.unitType;
    const singular = unitType.toLowerCase();
    return `Select ${singular.charAt(0).toUpperCase() + singular.slice(1)}`;
  };

  return (
    <>
      {studyLevelsLoading && studyLevels.length === 0 ? (
        <HierarchicalSidebarSkeleton />
      ) : (
        <div className="bg-surface border border-border rounded-2xl p-6 shadow-lg">
          <h2 className="text-xl font-bold text-foreground mb-6">Filter by Subject Hierarchy</h2>

          <div className="space-y-6">
            {/* Level 1: Study Level */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3 px-1">
                Study Level
              </label>
              {studyLevelsLoading ? (
                <DropdownSkeleton />
              ) : (
                <select
                  value={selectedStudyLevel || ''}
                  onChange={(e) => handleStudyLevelChange(e.target.value)}
                  className="w-full bg-surface border border-border rounded-2xl px-5 py-4 text-sm font-semibold focus:border-primary outline-none cursor-pointer appearance-none transition-colors"
                >
                  <option value="">Select a Study Level</option>
                  {studyLevels.map((level) => (
                    <option key={level.id} value={level.id}>
                      {level.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Level 2: Board */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3 px-1">
                Board
              </label>
              {boardsLoading ? (
                <DropdownSkeleton />
              ) : (
                <select
                  value={selectedBoard || ''}
                  onChange={(e) => handleBoardChange(e.target.value)}
                  disabled={!selectedStudyLevel}
                  className={`w-full bg-surface border border-border rounded-2xl px-5 py-4 text-sm font-semibold focus:border-primary outline-none cursor-pointer appearance-none transition-colors ${!selectedStudyLevel ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                >
                  <option value="">Select a Board</option>
                  {boards.map((board) => (
                    <option key={board.id} value={board.id}>
                      {board.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Level 3: Faculty */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3 px-1">
                Faculty / Stream
              </label>
              {facultiesLoading ? (
                <DropdownSkeleton />
              ) : (
                <select
                  value={selectedFaculty || ''}
                  onChange={(e) => handleFacultyChange(e.target.value)}
                  disabled={!selectedBoard}
                  className={`w-full bg-surface border border-border rounded-2xl px-5 py-4 text-sm font-semibold focus:border-primary outline-none cursor-pointer appearance-none transition-colors ${!selectedBoard ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                >
                  <option value="">Select a Faculty</option>
                  {faculties.map((faculty) => (
                    <option key={faculty.id} value={faculty.id}>
                      {faculty.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Level 4: Unit Value */}
            {selectedFaculty && (() => {
              const rawType = selectedFacultyDetails?.unitType ?? 'UNIT';
              const unitLabel = rawType.charAt(0) + rawType.slice(1).toLowerCase();
              return (
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3 px-1">
                    {getUnitTypeLabel()}
                  </label>
                  <select
                    value={selectedUnit ?? ''}
                    onChange={(e) => handleUnitChange(Number(e.target.value))}
                    disabled={!selectedFacultyDetails}
                    className={`w-full bg-surface border border-border rounded-2xl px-5 py-4 text-sm font-semibold focus:border-primary outline-none cursor-pointer appearance-none transition-colors ${!selectedFacultyDetails ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <option value="">Select {unitLabel}</option>
                    {unitOptions.map((unit) => (
                      <option key={unit} value={unit}>
                        {unitLabel} {unit}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })()}

            {/* Level 5: Subject */}
            {selectedUnit !== null && (
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3 px-1">
                  Subject
                </label>
                <select
                  value={selectedSubjectId ?? ''}
                  onChange={(e) => handleSubjectChange(e.target.value)}
                  disabled={unitSubjects.length === 0}
                  className={`w-full bg-surface border border-border rounded-2xl px-5 py-4 text-sm font-semibold focus:border-primary outline-none cursor-pointer appearance-none transition-colors ${unitSubjects.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {unitSubjects.length === 0 ? (
                    <option value="">No subjects found</option>
                  ) : (
                    <option value="">Select a Subject</option>
                  )}
                  {unitSubjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Selected Subject Info */}
            {selectedSubject && (
              <div className="bg-subtle rounded-xl p-4 border border-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Selected Subject
                </p>
                <p className="font-bold text-foreground mb-1">{selectedSubject.name}</p>
                <p className="text-xs text-muted-foreground">
                  {`${selectedFacultyDetails?.unitType || 'Unit'} ${selectedUnit}`}
                </p>
              </div>
            )}
          </div>

          {/* Teachers Results Section — only shown when page is not handling results */}
          {selectedSubject && !hideInlineResults && (
            <div className="mt-8 border-t border-border pt-8">
              <h3 className="text-lg font-bold text-foreground mb-6">
                Available Teachers ({teachers.length})
              </h3>

              {teachersLoading ? (
                <TeacherCardSkeletonGrid count={3} />
              ) : teachers.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto pr-2">
                  {teachers.map((teacher) => (
                    <div
                      key={teacher.teacherId}
                      className="bg-subtle border border-border rounded-xl p-4 hover:bg-subtle/80 transition-colors cursor-pointer"
                    >
                      <div className="flex gap-3 mb-3">
                        {teacher.teacherAvatarUrl && (
                          <div className="w-12 h-12 rounded-full bg-subtle shrink-0 text-xs flex items-center justify-center font-bold text-muted-foreground">
                            {teacher.teacherName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground truncate">{teacher.teacherName}</p>
                          <p className="text-xs text-muted-foreground">
                            {teacher.yearsOfExperience} year{teacher.yearsOfExperience !== 1 ? 's' : ''} exp.
                          </p>
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-1">
                          <span className="text-yellow-500">★</span>
                          <span className="font-semibold">{teacher.avgRating.toFixed(1)}</span>
                          <span className="text-xs text-muted-foreground">({teacher.ratingCount})</span>
                        </div>
                        <p className="font-bold text-primary">₨{teacher.ratePerSession}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No teachers available for this subject
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default HierarchicalSidebar;
