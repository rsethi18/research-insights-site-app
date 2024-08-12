const express = require('express');
const multer = require('multer');
const pdf = require('pdf-parse');
const cors = require('cors');
const axios = require('axios');
const natural = require('natural');
const TfIdf = natural.TfIdf;

const app = express();
app.use(cors());

const upload = multer({ storage: multer.memoryStorage() });

const systemMessage = `You are an expert academic research analyst specializing in creating cohesive summaries of complex scientific papers. Your task is to generate a well-structured summary that captures the essence of the research paper across its entirety. Follow these guidelines:

1. Maintain continuity and context throughout the summary.
2. For the first chunk, start by identifying the main research question, hypothesis, or objective.
3. For subsequent chunks, continue the summary by integrating new information seamlessly.
4. Highlight key methodologies and experimental designs as they appear.
5. Summarize principal findings and their significance throughout the paper.
6. Note any limitations or areas for future research mentioned.
7. If applicable, mention any groundbreaking or controversial aspects of the research.
8. Maintain an objective, academic tone throughout the summary.
9. Ensure the summary flows logically and reads as a cohesive piece, not as disjointed segments.`;

const userMessageTemplate = (summaryType, chunk, isFirstChunk) => `
Continue the analysis and summary of this research paper. This chunk is ${isFirstChunk ? 'the beginning' : 'a continuation'} of the document. ${isFirstChunk ? 'Start the summary by introducing the main topic and research question.' : 'Continue the summary by integrating this information with what has been summarized before.'} Provide a ${summaryType} summary based on the following criteria:

For a simple summary:
- Focus on the main ideas and key findings.
- Keep the language accessible to a general audience.
- Aim for concise paragraphs.

For an intermediate summary:
- Include the research question, key methodologies, and principal findings.
- Briefly touch on the significance of the results.
- Use language suitable for an undergraduate student in the field.
- Provide moderate detail.

For an advanced summary:
- Provide a comprehensive overview including research context, detailed methodology, results, and implications.
- Discuss any theoretical frameworks or models used.
- Mention statistical analyses or key data points if present.
- Include any limitations or future research directions noted.
- Use technical language appropriate for graduate-level researchers in the field.
- Develop a thorough summary with detailed paragraphs.

Research excerpt to summarize:
${chunk}`

function chunkText(text, maxChars) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    let end = start + maxChars;
    if (end > text.length) end = text.length;
    chunks.push(text.slice(start, end));
    start = end;
  }
  return chunks;
}

const retryRequest = async (fn, retries = 3, delay = 1000) => {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0 && error.response && error.response.status === 429) {
      console.log(`Rate limit hit, retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return retryRequest(fn, retries - 1, delay * 2);
    } else {
      throw error;
    }
  }
};

function extractKeywordsWithTFIDF(text, numKeywords = 50) {
  const tfidf = new TfIdf();
  tfidf.addDocument(text);
  
  const scores = {};
  tfidf.listTerms(0 /*document index*/).forEach(item => {
    if (item.term.length > 2 && 
        !/^\d+$/.test(item.term) &&  // Exclude numbers
        !['arxiv', 'preprint', 'doi'].includes(item.term.toLowerCase())) {
      scores[item.term] = item.tfidf;
    }
  });

  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, numKeywords)
    .map(([text, value]) => ({ text, value }));
}

function removeEmptyParentheses(text) {
  return text.replace(/\(\s*\)/g, '').trim();
}

async function extractTitleUsingGPT(text) {
  const openaiRequestBody = {
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: 'You are a helpful assistant that extracts the title of a research paper from its text.' },
      { role: 'user', content: `Extract the title of the research paper from the following text. Only return the title, nothing else:\n\n${text.substring(0, 1000)}` }
    ]
  };

  try {
    const openaiResponse = await axios.post('https://api.openai.com/v1/chat/completions', openaiRequestBody, {
      headers: {
        'Authorization': `Bearer YOUR_OPENAI_API_KEY`,
        'Content-Type': 'application/json'
      }
    });
    const extractedTitle = openaiResponse.data.choices[0].message.content.trim();
    return removeEmptyParentheses(extractedTitle);
  } catch (error) {
    console.error('Error extracting title using GPT:', error);
    return null;
  }
}

async function getSemanticScholarInfo(title, maxRetries = 5, initialDelay = 4000) {
  if (!title || title.trim() === '') {
    console.log('Empty title provided to getSemanticScholarInfo');
    return null;
  }

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const delay = initialDelay + attempt * 1000; // Increase delay with each attempt
      await new Promise(resolve => setTimeout(resolve, delay));

      const response = await axios.get(`http://api.semanticscholar.org/graph/v1/paper/search`, {
        params: {
          query: title,
          limit: 1,
          fields: 'title,authors,year,citationCount,influentialCitationCount,citations'
        }
      });

      if (response.data.data && response.data.data.length > 0) {
        const paper = response.data.data[0];
        return {
          title: paper.title,
          authors: paper.authors ? paper.authors.map(author => author.name) : [],
          year: paper.year,
          citationCount: paper.citationCount,
          influentialCitationCount: paper.influentialCitationCount,
          citations: paper.citations || []
        };
      }

      console.log(`Attempt ${attempt + 1}: No results found. Retrying in ${delay}ms...`);
    } catch (error) {
      console.error(`Attempt ${attempt + 1}: Error fetching Semantic Scholar info:`, error.message);
      if (attempt < maxRetries - 1) {
        const delay = initialDelay + (attempt + 1) * 1000;
        console.log(`Retrying in ${delay}ms...`);
      }
    }
  }

  console.log('Failed to fetch Semantic Scholar info after all retries');
  return null;
}

async function extractKeyTakeaways(summary) {
  const openaiRequestBody = {
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: 'You are an expert at identifying key takeaways and main points in academic research papers.' },
      { role: 'user', content: `Based on the following summary of a research paper, identify 5-7 key takeaways or main points. Present them as concise bullet points:\n\n${summary}` }
    ]
  };

  try {
    const openaiResponse = await axios.post('https://api.openai.com/v1/chat/completions', openaiRequestBody, {
      headers: {
        'Authorization': `Bearer YOUR_OPENAI_API_KEY`,
        'Content-Type': 'application/json'
      }
    });
    return openaiResponse.data.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error extracting key takeaways:', error);
    return null;
  }
}

app.post('/summarize', upload.single('file'), async (req, res) => {
  console.log('Received request');
  if (!req.file) {
    console.log('No file uploaded');
    return res.status(400).send('No file uploaded.');
  }

  try {
    console.log('Parsing PDF...');
    const data = await pdf(req.file.buffer);
    console.log('PDF parsed successfully');

    // Extract title using GPT-3.5 and remove empty parentheses
    const title = await extractTitleUsingGPT(data.text);
    console.log('Extracted title:', title);

    if (!title) {
      console.log('Unable to extract title from PDF');
      return res.status(400).json({ error: 'Unable to extract title from PDF' });
    }

    const textChunks = chunkText(data.text, 3500);
    
    console.log('Processing chunks in parallel...');
    const summaryPromises = textChunks.map(async (chunk, index) => {
      const openaiRequestBody = {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userMessageTemplate(req.body.summaryType, chunk, index === 0) }
        ]
      };

      const openaiResponse = await retryRequest(() => axios.post('https://api.openai.com/v1/chat/completions', openaiRequestBody, {
        headers: {
          'Authorization': `Bearer YOUR_OPENAI_API_KEY`,
          'Content-Type': 'application/json'
        }
      }));
      return openaiResponse.data.choices[0].message.content;
    });

    // Start fetching Semantic Scholar info early
    const scholarInfoPromise = getSemanticScholarInfo(title);

    const summaries = await Promise.all(summaryPromises);
    console.log('All chunks processed');

    const finalSummary = summaries.join('\n\n');

    // Extract keywords using TF-IDF
    const keywords = extractKeywordsWithTFIDF(data.text);

    // Extract key takeaways
    const keyTakeaways = await extractKeyTakeaways(finalSummary);

    // Wait for Semantic Scholar info
    const scholarInfo = await scholarInfoPromise;

    res.json({ 
      summary: finalSummary,
      semanticScholarInfo: scholarInfo,
      keywords: keywords,
      keyTakeaways: keyTakeaways
    });
  } catch (error) {
    console.error('Detailed error:', error);
    if (error.response) {
      console.error('API response:', error.response.data);
      res.status(500).send(`Error from OpenAI API: ${error.response.data.error.message}`);
    } else {
      res.status(500).send(`Error processing the PDF or generating summary: ${error.message}`);
    }
  }
});

app.listen(3001, () => console.log('Server running on port 3001'));