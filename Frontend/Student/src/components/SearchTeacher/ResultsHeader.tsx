
import React from 'react';

interface ResultsHeaderProps {
  count: number;
}

const ResultsHeader: React.FC<ResultsHeaderProps> = ({ count }) => {
  return (
    <div className="mb-8">
      <p className="text-sm text-muted-foreground font-medium">
        Showing <span className="text-foreground font-bold">{count}</span> tutors matching your criteria
      </p>
    </div>
  );
};

export default ResultsHeader;
