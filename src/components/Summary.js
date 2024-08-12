import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.entry';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

function Summary({ file, summaryType, setSummary }) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const generateSummary = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const fileContent = await readFileContent(file);
        const chunks = splitIntoChunks(fileContent, 2000); // Split into chunks of about 2000 words
        
        let chunkSummaries = [];
        for (let chunk of chunks) {
          const chunkSummary = await summarizeChunk(chunk, summaryType);
          chunkSummaries.push(chunkSummary);
        }
        
        const finalSummary = await combineChunkSummaries(chunkSummaries, summaryType);
        setSummary(finalSummary);
      } catch (error) {
        console.error('Error generating summary:', error);
        setError('Failed to generate summary. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    generateSummary();
  }, [file, summaryType, setSummary]);

  if (isLoading) {
    return <div>Generating summary...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  return null;
}

async function readFileContent(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({data: arrayBuffer}).promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .filter(item => item.str.trim().length > 0) // Filter out empty strings
      .map(item => item.str)
      .join(' ');
    fullText += pageText + '\n\n'; // Add page breaks
  }

  // Basic cleaning
  fullText = fullText.replace(/(\r\n|\n|\r)/gm, " ") // Remove line breaks
                     .replace(/\s+/g, " ") // Remove extra spaces
                     .trim();

  return fullText;
}
function splitIntoChunks(text, wordsPerChunk) {
  const words = text.split(/\s+/);
  const chunks = [];
  for (let i = 0; i < words.length; i += wordsPerChunk) {
    chunks.push(words.slice(i, i + wordsPerChunk).join(' '));
  }
  return chunks;
}

async function summarizeChunk(chunk, summaryType) {
  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a helpful assistant that summarizes research papers.' },
        { role: 'user', content: `Summarize the following chunk of a research paper in a ${summaryType} style: ${chunk}` }
      ]
    },
    {
      headers: {
        'Authorization': `Bearer 1234`,
        'Content-Type': 'application/json'
      }
    }
  );

  return response.data.choices[0].message.content;
}

async function combineChunkSummaries(chunkSummaries, summaryType) {
  const combinedSummary = chunkSummaries.join('\n\n');
  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a helpful assistant that combines summaries of research paper sections.' },
        { role: 'user', content: `Combine the following summaries into a cohesive ${summaryType} summary of the entire research paper: ${combinedSummary}` }
      ]
    },
    {
      headers: {
        'Authorization': `Bearer 1234`,
        'Content-Type': 'application/json'
      }
    }
  );

  return response.data.choices[0].message.content;
}

export default Summary;