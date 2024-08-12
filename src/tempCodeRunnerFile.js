import React, { useState } from 'react';
import axios from 'axios';

function App() {
  const [file, setFile] = useState(null);
  const [summary, setSummary] = useState('');
  const [summaryType, setSummaryType] = useState('');

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleSummaryType = (type) => {
    setSummaryType(type);
    if (file) generateSummary(type);
  };

  const generateSummary = async (type) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('summaryType', type);

    try {
      const response = await axios.post('http://localhost:3001/summarize', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setSummary(response.data.summary);
    } catch (error) {
      console.error('Error generating summary:', error);
      setSummary('Failed to generate summary. Please try again.');
    }
  };

  return (
    <div className="App">
      <input type="file" onChange={handleFileChange} />
      <div>
        <button onClick={() => handleSummaryType('simple')}>Simple</button>
        <button onClick={() => handleSummaryType('intermediate')}>Intermediate</button>
        <button onClick={() => handleSummaryType('advanced')}>Advanced</button>
      </div>
      {summary && <div>{summary}</div>}
    </div>
  );
}

export default App;