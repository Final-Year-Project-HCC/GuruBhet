
import React from 'react';

interface ResultsHeaderProps {
  count: number;
}

const ResultsHeader: React.FC<ResultsHeaderProps> = ({ count }) => {
  return (
    <div className="mb-8">
      <p className="text-sm text-slate-500 font-medium">
        Showing <span className="text-slate-900 font-bold">{count}</span> tutors matching your criteria
      </p>
    </div>
  );
};

export default ResultsHeader;
