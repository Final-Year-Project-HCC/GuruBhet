'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api';
import { toast } from 'react-toastify';
import type { TeacherAcademicSubject } from '@/lib/types';

interface SubjectListProps {
  onSubjectDeleted?: () => void;
}

export function SubjectList({ onSubjectDeleted }: SubjectListProps) {
  const queryClient = useQueryClient();

  // Fetch teacher subjects
  const {
    data: teacherSubjects = [],
    isLoading,
    error,
  } = useQuery<TeacherAcademicSubject[]>({
    queryKey: ['teacherSubjects'],
    queryFn: async () => {
      const response = await apiClient.get('/teachers/me/subjects');
      return response.data.data || [];
    },
  });

  // Delete subject mutation
  const deleteSubjectMutation = useMutation({
    mutationFn: async (subjectId: string) => {
      await apiClient.delete(`/teachers/me/subjects/${subjectId}`);
    },
    onSuccess: () => {
      toast.success('Subject removed successfully');
      queryClient.invalidateQueries({ queryKey: ['teacherSubjects'] });
      onSubjectDeleted?.();
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to delete subject');
    },
  });

  const handleDelete = (subjectId: string, subjectName: string) => {
    if (window.confirm(`Are you sure you want to remove "${subjectName}"?`)) {
      deleteSubjectMutation.mutate(subjectId);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-muted-foreground">Loading subjects...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-destructive">Failed to load subjects</div>
      </div>
    );
  }

  if (teacherSubjects.length === 0) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-muted-foreground">No subjects added yet.</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold mb-4">Your Teaching Subjects</h3>
        
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-border">
                <th className="text-left px-4 py-3 font-semibold text-foreground">Subject</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground">Hierarchy</th>
                <th className="text-right px-4 py-3 font-semibold text-foreground">Rate (NPR)</th>
                <th className="text-right px-4 py-3 font-semibold text-foreground">Experience</th>
                <th className="text-center px-4 py-3 font-semibold text-foreground">Action</th>
              </tr>
            </thead>
            <tbody>
              {teacherSubjects.map((ts: TeacherAcademicSubject) => (
                <tr
                  key={ts.subjectId}
                  className="border-b border-border hover:bg-muted/50 transition-colors"
                >
                  <td className="px-4 py-3 font-medium">{ts.subject.name}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    <div>
                      {ts.subject.studyLevel.name} {ts.subject.board.name}{' '}
                      {ts.subject.faculty.name} {ts.subject.unitValue}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-semibold">Rs. {ts.ratePerSession}</span>
                  </td>
                  <td className="px-4 py-3 text-right">{ts.yearsOfExperience} years</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleDelete(ts.subjectId, ts.subject.name)}
                      disabled={deleteSubjectMutation.isPending}
                      className="px-3 py-1 bg-muted text-destructive rounded-md hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs font-medium border border-destructive"
                    >
                      {deleteSubjectMutation.isPending ? 'Removing...' : 'Remove'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-4">
          {teacherSubjects.map((ts: TeacherAcademicSubject) => (
            <div
              key={ts.subjectId}
              className="border border-border rounded-lg p-4 space-y-3"
            >
              <div className="flex justify-between items-start gap-2">
                <div>
                  <h4 className="font-semibold text-foreground">{ts.subject.name}</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    {ts.subject.studyLevel.name} · {ts.subject.board.name} · {ts.subject.faculty.name}
                  </p>
                </div>
              </div>
              <div className="flex justify-between items-center text-sm">
                <div>
                  <div className="text-muted-foreground">Rate</div>
                  <div className="font-semibold">Rs. {ts.ratePerSession}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Experience</div>
                  <div className="font-semibold">{ts.yearsOfExperience}y</div>
                </div>
              </div>
              <button
                onClick={() => handleDelete(ts.subjectId, ts.subject.name)}
                disabled={deleteSubjectMutation.isPending}
                className="w-full px-3 py-2 bg-muted text-destructive rounded-md hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium border border-destructive"
              >
                {deleteSubjectMutation.isPending ? 'Removing...' : 'Remove Subject'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
