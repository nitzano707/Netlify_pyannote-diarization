const axios = require('axios');

exports.handler = async function(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  try {
    const { jobId } = event.queryStringParameters;
    if (!jobId) {
      throw new Error('No jobId provided');
    }

    console.log('Checking status for jobId:', jobId);

    const response = await axios.get(`https://api.pyannote.ai/v1/jobs/${jobId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.PYANNOTE_API_KEY}`
      }
    });

    console.log('Status response:', response.data);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response.data)
    };

  } catch (error) {
    console.error('Error checking status:', error);
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
