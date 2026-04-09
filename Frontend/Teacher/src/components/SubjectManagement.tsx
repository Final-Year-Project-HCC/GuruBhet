'use client';

import React, { useState } from 'react';
import { HierarchicalSubjectForm } from './HierarchicalSubjectForm';
import { SubjectList } from './SubjectList';

/**
 * SubjectManagement Component
 * Tab content for managing teaching subjects.
 * Combines the hierarchical form and the subject list.
 */
export function SubjectManagement() {
  const [, setRefreshKey] = useState(0);

  const handleSubjectAdded = () => {
    // Trigger refresh of the subject list
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="space-y-12">
      {/* Form Section */}
      <HierarchicalSubjectForm onSuccess={handleSubjectAdded} />

      {/* Subject List Section */}
      <div className="pt-8 border-t border-border">
        <SubjectList onSubjectDeleted={handleSubjectAdded} />
      </div>
    </div>
  );
}
