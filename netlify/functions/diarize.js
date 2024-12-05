const axios = require('axios');
const FormData = require('form-data');

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

    // קבלת URL זמני מ-pyannote
    const mediaUrl = 'media://nitzantry1';
    
    const response = await axios.post('https://api.pyannote.ai/v1/media/input', 
      { url: mediaUrl },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // הוצאת ה-URL מהתשובה
    const uploadUrl = response.data.url;

    // קבלת הקובץ מהבקשה
    const fileData = event.body;

    // העלאת הקובץ ל-URL שקיבלנו
    await axios.put(uploadUrl, fileData, {
      headers: {
        'Content-Type': 'audio/mpeg'
      }
    });

    // התחלת תהליך הזיהוי
    const diarizeResponse = await axios.post('https://api.pyannote.ai/v1/diarize',
      { url: mediaUrl },
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
      body: JSON.stringify(diarizeResponse.data)
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
