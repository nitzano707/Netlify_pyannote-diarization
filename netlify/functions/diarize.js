const axios = require('axios');

exports.handler = async function(event, context) {
  console.log('Function started');

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // בקשת preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers };
  }

  try {
    const apiKey = process.env.PYANNOTE_API_KEY;
    console.log('API Key exists:', !!apiKey);

    if (!apiKey) {
      throw new Error('API key not configured');
    }

    // יצירת URL עבור הקובץ
    const uniqueId = `file_${Date.now()}`;
    const mediaUrl = `media://${uniqueId}`;
    
    // כתובת ה-webhook שלנו - נשתמש באותה פונקציה אבל עם נתיב אחר
    const webhookUrl = `${process.env.URL}/.netlify/functions/diarize-webhook`;
    console.log('Webhook URL:', webhookUrl);

    // קבלת URL זמני
    const response = await axios.post('https://api.pyannote.ai/v1/media/input', 
      { url: mediaUrl },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Got temporary URL:', response.data.url);

    // התחלת תהליך הזיהוי עם webhook
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

    console.log('Diarization started:', diarizeResponse.data);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        tempUrl: response.data.url,
        mediaUrl: mediaUrl,
        jobId: diarizeResponse.data.jobId,
        message: 'Diarization process started'
      })
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
