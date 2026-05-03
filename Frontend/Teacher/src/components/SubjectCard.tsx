import React from 'react';
import { TeacherSubject } from '@/lib/types';

interface SubjectCardProps {
    teacherSubject: TeacherSubject;
}

const SubjectCard: React.FC<SubjectCardProps> = ({
    teacherSubject,
}) => {
    const { subject, ratePerSession, experienceMinutes } = teacherSubject;

    // Build hierarchical context string
    const hierarchyBadges = [
        subject.faculty?.studyLevel?.name,
        subject.faculty?.board?.name,
        subject.faculty?.name,
    ].filter(Boolean);

    // Unit context: e.g., "Semester 5" or "Grade 12"
    const unitContext = `${subject.faculty?.unitType || 'Unit'} ${subject.unitValue}`;

    const formattedExperience = (() => {
        if (!experienceMinutes || experienceMinutes <= 0) return '0m';
        if (experienceMinutes < 60) return `${experienceMinutes}m`;
        const hours = Math.floor(experienceMinutes / 60);
        const remaining = experienceMinutes % 60;
        return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`;
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

            {/* Pricing & Experience */}
            <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">
                        Rate/Session
                    </p>
                    <p className="text-2xl font-black text-primary tracking-tighter">
                        NPR {ratePerSession}
                    </p>
                </div>
                <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">
                        Experience
                    </p>
                    <p className="text-2xl font-black tracking-tighter">
                        {formattedExperience}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default SubjectCard;
