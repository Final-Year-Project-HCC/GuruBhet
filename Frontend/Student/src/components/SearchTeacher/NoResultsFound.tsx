
import React from 'react';

interface NoResultsFoundProps {
  onReset: () => void;
}

const NoResultsFound: React.FC<NoResultsFoundProps> = ({ onReset }) => {
  return (
    <div className="bg-surface border-2 border-dashed border-border rounded-[3rem] py-32 text-center max-w-2xl mx-auto">
      <h3 className="text-2xl font-black mb-4">No tutors found</h3>
      <p className="text-muted-foreground mb-8">
        Try adjusting your filters to find more results.
      </p>
      <button
        onClick={onReset}
        className="bg-primary text-primary-foreground px-8 py-4 rounded-2xl font-bold hover:bg-primary-hover hover:text-primary-hover-foreground transition-colors"
      >
        Clear all filters
      </button>
    </div>
  );
};

export default NoResultsFound;
