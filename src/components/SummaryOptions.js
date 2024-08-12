import React from 'react';

function SummaryOptions({ setSummaryType }) {
  return (
    <div className="summary-options">
      <h2>Select Summary Type:</h2>
      <button onClick={() => setSummaryType('simple')}>Simple</button>
      <button onClick={() => setSummaryType('intermediate')}>Intermediate</button>
      <button onClick={() => setSummaryType('advanced')}>Advanced</button>
    </div>
  );
}

export default SummaryOptions;