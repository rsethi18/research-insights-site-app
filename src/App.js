import React, { useState } from 'react';
import axios from 'axios';
import ReactWordcloud from 'react-wordcloud';
import './App.css';

function App() {
  const [file, setFile] = useState(null);
  const [summary, setSummary] = useState('');
  const [summaryType, setSummaryType] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSummary, setHasSummary] = useState(false);
  const [scholarInfo, setScholarInfo] = useState(null);
  const [keywords, setKeywords] = useState([]);
  const [keyTakeaways, setKeyTakeaways] = useState('');

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setError('');
    setSummary('');
    setHasSummary(false);
    setScholarInfo(null);
    setKeywords([]);
    setKeyTakeaways('');
  };

  const handleSummaryType = (type) => {
    setSummaryType(type);
    if (file) generateSummary(type);
  };

  const generateSummary = async (type) => {
    setIsLoading(true);
    setError('');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('summaryType', type);

    try {
      const response = await axios.post('http://localhost:3001/summarize', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setSummary(response.data.summary);
      setScholarInfo(response.data.semanticScholarInfo);
      setKeywords(response.data.keywords || []);
      setKeyTakeaways(response.data.keyTakeaways || '');
      setHasSummary(true);
    } catch (error) {
      console.error('Error generating summary:', error);
      setError('Failed to generate summary. Please try again.');
      setSummary('');
      setScholarInfo(null);
      setKeywords([]);
      setKeyTakeaways('');
      setHasSummary(false);
    } finally {
      setIsLoading(false);
    }
  };

  const filterKeywords = (keywords) => {
    return keywords.filter(keyword => {
      const text = keyword.text.toLowerCase();
      return !/^\d{4}$/.test(text) && 
             !['arxiv', 'preprint', 'doi'].includes(text);
    });
  };

  const wordcloudOptions = {
    rotations: 1,
    rotationAngles: [0, 0],
    fontSizes: [12, 60],
    fontFamily: 'Arial',
    fontWeight: 'bold',
    padding: 1,
    scale: 'sqrt',
    spiral: 'archimedean',
  };

  const filteredKeywords = filterKeywords(keywords);

  return (
    <div className="App">
      <div className={`container ${hasSummary ? 'compact' : ''}`}>
        <h1 className="title">Research Insight Generator</h1>
        <div className="upload-container">
          <label htmlFor="file-input" className="file-label">
            <span className="file-icon">📄</span>
            Choose your research paper
          </label>
          <input
            id="file-input"
            type="file"
            onChange={handleFileChange}
            accept=".pdf"
            className="file-input"
          />
          {file && <p className="file-name">{file.name}</p>}
        </div>
        <div className="summary-options">
          <button onClick={() => handleSummaryType('simple')} className={`btn ${summaryType === 'simple' ? 'active' : ''}`} disabled={!file || isLoading}>Simple</button>
          <button onClick={() => handleSummaryType('intermediate')} className={`btn ${summaryType === 'intermediate' ? 'active' : ''}`} disabled={!file || isLoading}>Intermediate</button>
          <button onClick={() => handleSummaryType('advanced')} className={`btn ${summaryType === 'advanced' ? 'active' : ''}`} disabled={!file || isLoading}>Advanced</button>
        </div>
        {isLoading && 
          <div className="loader">
            <div className="spinner"></div>
            <p>Generating insights...</p>
          </div>
        }
        {error && <div className="error-message">{error}</div>}
      </div>
      {summary && (
        <div className="bento-grid">
          <div className="bento-item summary-container">
            <h3>Summary</h3>
            <div className="summary-text" dangerouslySetInnerHTML={{ 
              __html: summary.split('\n\n').map(para => `<p>${para}</p>`).join('')
            }} />
          </div>
          <div className="bento-item key-takeaways">
            <h3>Key Takeaways</h3>
            {keyTakeaways ? (
              <ul dangerouslySetInnerHTML={{ 
                __html: keyTakeaways
                  .split('\n')
                  .filter(point => point.trim() !== '')
                  .map(point => `<li>${point.replace(/^-\s*/, '')}</li>`)
                  .join('')
              }} />
            ) : (
              <p>No key takeaways available.</p>
            )}
          </div>
          <div className="bento-item additional-info">
            <h3>Additional Information</h3>
            {scholarInfo ? (
              <div className="scholar-info">
                <p><strong>Title:</strong> {scholarInfo.title}</p>
                <p><strong>Authors:</strong> {scholarInfo.authors.join(', ')}</p>
                <p><strong>Year:</strong> {scholarInfo.year}</p>
                <p><strong>Citation Count:</strong> {scholarInfo.citationCount}</p>
                <p><strong>Influential Citation Count:</strong> {scholarInfo.influentialCitationCount}</p>
                <h4>Related Papers:</h4>
                <ul className="related-papers">
                  {scholarInfo.citations.slice(0, 5).map((citation, index) => (
                    <li key={index} style={{
                      borderBottom: index < 4 ? '1px solid #e0e0e0' : 'none',
                      paddingBottom: '10px',
                      marginBottom: '10px'
                    }}>
                      {citation.title} {citation.year}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p>No additional information available.</p>
            )}
          </div>
          <div className="bento-item keyword-cloud">
            <h3>Keyword Cloud</h3>
            {filteredKeywords.length > 0 ? (
              <div style={{ width: '100%', height: '300px', marginTop: '-20px' }}>
                <ReactWordcloud
                  words={filteredKeywords}
                  options={wordcloudOptions}
                  callbacks={{
                    getWordTooltip: () => "",
                  }}
                />
              </div>
            ) : (
              <p>No keywords available.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;