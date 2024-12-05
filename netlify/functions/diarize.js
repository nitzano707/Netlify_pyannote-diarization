const axios = require('axios');

exports.handler = async function(event, context) {
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

  try {
    // Get API key from environment variable
    const apiKey = process.env.PYANNOTE_API_KEY;
    console.log('Checking API key format:', apiKey?.substring(0, 5) + '...');  // רק לבדיקה - מציג רק את תחילת המפתח

    if (!apiKey || !apiKey.startsWith('sk_')) {
      throw new Error('Invalid API key format');
    }

    // Make request to pyannote API
    console.log('Making request to pyannote API...');
    const response = await axios.post('https://api.pyannote.ai/v1/media/input', 
      {
        url: `media://file_${Date.now()}`
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Received response from pyannote:', response.status);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response.data)
    };

  } catch (error) {
    console.error('Error details:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
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
