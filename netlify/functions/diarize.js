const axios = require('axios');

exports.handler = async function(event, context) {
  console.log('Function started');

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers };
  }

  try {
    const apiKey = process.env.PYANNOTE_API_KEY;
    console.log('API Key exists:', !!apiKey);

    if (!apiKey) {
      throw new Error('API key not configured');
    }

    // Generate a simple, URL-safe identifier
    const objectKey = `audio_${Date.now()}`
      .replace(/[^a-zA-Z0-9]/g, '')
      .toLowerCase();
    
    const mediaUrl = `media://${objectKey}`;
    console.log('Using media URL:', mediaUrl);

    // Step 1: Get temporary URL
    const response = await axios.post('https://api.pyannote.ai/v1/media/input', 
      { 
        url: mediaUrl
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Received response:', response.data);

    const webhookUrl = `${process.env.URL}/.netlify/functions/diarize-webhook`;

    // Step 2: Start diarization process
    const diarizeResponse = await axios.post('https://api.pyannote.ai/v1/diarize',
      {
        url: mediaUrl,
        webhook: webhookUrl
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        tempUrl: response.data.url,
        mediaUrl: mediaUrl,
        jobId: diarizeResponse.data.jobId,
        message: 'Process started successfully'
      })
    };

  } catch (error) {
    console.error('Full error:', error);
    console.error('Error response:', error.response?.data);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error.message,
        details: error.response?.data || 'No additional details'
      })
    };
  }
};
