
import React from 'react';
import { Teacher } from '../types';
import SearchTeacherCard from './SearchTeacherCard';
import NoResultsFound from './NoResultsFound';

interface TutorResultsProps {
  teachers: Teacher[];
  onMessage: (id: string, e: React.MouseEvent) => void;
  onViewProfile: (id: string) => void;
  onReset: () => void;
}

const TutorResults: React.FC<TutorResultsProps> = ({
  teachers,
  onMessage,
  onViewProfile,
  onReset,
}) => {
  return (
    <div className="min-h-[400px]">
      {teachers.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {teachers.map((teacher) => (
            <SearchTeacherCard
              key={teacher.id}
              teacher={teacher}
              onMessage={(e) => onMessage(teacher.id, e)}
              onClick={() => onViewProfile(teacher.id)}
            />
          ))}
        </div>
      ) : (
        <NoResultsFound onReset={onReset} />
      )}
    </div>
  );
};

export default TutorResults;
