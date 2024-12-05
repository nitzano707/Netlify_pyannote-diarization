const axios = require('axios');

exports.handler = async function(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers
    };
  }

  try {
    const apiKey = process.env.PYANNOTE_API_KEY;
    
    if (!apiKey) {
      throw new Error('API key not configured');
    }

    // שימוש באותו פורמט בדיוק כמו בדוגמה שלהם
    const mediaUrl = 'media://nitzantry1';

    console.log('Requesting temporary URL with:', mediaUrl);

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

    console.log('Response status:', response.status);
    console.log('Response data:', response.data);

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
