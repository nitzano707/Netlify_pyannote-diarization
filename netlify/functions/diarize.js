const axios = require('axios');

exports.handler = async function(event, context) {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const apiKey = process.env.PYANNOTE_API_KEY;
    if (!apiKey) {
      throw new Error('API key not configured');
    }

    // Get temporary URL from pyannote
    const response = await axios.post('https://api.pyannote.ai/v1/media/input', 
      {
        url: `media://file_${Date.now()}`
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response.data)
    };
  } catch (error) {
    console.error('Error:', error);
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
