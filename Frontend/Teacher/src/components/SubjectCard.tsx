import React from 'react';
import { TeacherSubject } from '@/lib/types';

interface SubjectCardProps {
    teacherSubject: TeacherSubject;
}

const SubjectCard: React.FC<SubjectCardProps> = ({
    teacherSubject,
}) => {
    const { subject, ratePerSession, experienceMinutes, avgRating, ratingCount } = teacherSubject;

    // Build hierarchical context string
    const hierarchyBadges = [
        subject.faculty?.studyLevel?.name,
        subject.faculty?.board?.name,
        subject.faculty?.name,
    ].filter(Boolean);

    // Unit context: e.g., "Semester 5" or "Grade 12"
    const unitContext = `${subject.faculty?.unitType || 'Unit'} ${subject.unitValue}`;

    const formattedExperience = (() => {
        if (!experienceMinutes || experienceMinutes <= 0) return '0h';
        const hours = experienceMinutes / 60;
        return hours % 1 === 0 ? `${hours}h` : `${hours.toFixed(1)}h`;
    })();

    return (
        <div className="bg-surface border border-border rounded-3xl p-6 hover:shadow-lg transition-all hover:border-primary/50 group">
            {/* Subject Name */}
            <h3 className="text-xl font-black tracking-tight mb-3 group-hover:text-primary transition-colors">
                {subject.name}
            </h3>

            {/* Hierarchy Badges */}
            <div className="flex flex-wrap gap-2 mb-4">
                {hierarchyBadges.map((badge, idx) => (
                    <span
                        key={idx}
                        className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-muted-foreground bg-muted/30 px-3 py-1.5 rounded-lg"
                    >
                        {badge}
                    </span>
                ))}
            </div>

            {/* Unit Context */}
            <div className="mb-4 pb-4 border-b border-border/50">
                <p className="text-sm text-muted-foreground">
                    <span className="font-bold text-foreground">{unitContext}</span>
                    {' '}
                    {subject.faculty?.description && (
                        <span className="text-xs italic">• {subject.faculty.description}</span>
                    )}
                </p>
            </div>

            {/* Pricing, Experience & Rating */}
            <div className="grid grid-cols-3 gap-3 mb-6">
                <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">
                        Rate/Session
                    </p>
                    <p className="text-xl font-black text-primary tracking-tighter">
                        NPR {ratePerSession}
                    </p>
                </div>
                <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">
                        Exp. (Platform)
                    </p>
                    <p className="text-xl font-black tracking-tighter">
                        {formattedExperience}
                    </p>
                </div>
                <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">
                        Rating
                    </p>
                    <p className="text-xl font-black tracking-tighter flex items-center gap-1">
                        {Number(avgRating).toFixed(1)}
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-foreground inline" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <span className="text-xs font-bold text-muted-foreground">({ratingCount})</span>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default SubjectCard;
