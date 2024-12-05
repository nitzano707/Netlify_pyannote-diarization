const axios = require('axios');
const FormData = require('form-data');

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

    // בדיקה שקיבלנו קובץ
    if (!event.isBase64Encoded || !event.body) {
      console.error('No file uploaded or file is not base64 encoded');
      throw new Error('No file was uploaded');
    }

    // המרת הקובץ מ-base64
    const fileBuffer = Buffer.from(event.body, 'base64');
    console.log('Received file of size:', fileBuffer.length);

    // יצירת מזהה ייחודי
    const objectKey = `audio_${Date.now()}`.replace(/[^a-zA-Z0-9]/g, '');
    const mediaUrl = `media://${objectKey}`;
    console.log('Using media URL:', mediaUrl);

    // קבלת URL זמני מ-pyannote
    let response;
    try {
      response = await axios.post('https://api.pyannote.ai/v1/media/input', 
        { url: mediaUrl },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      console.log('Got temporary URL:', response.data.url);
    } catch (error) {
      console.error('Error getting temporary URL from pyannote:', error);
      throw new Error('Failed to get temporary URL from pyannote');
    }

    // העלאת הקובץ
    try {
      await axios.put(response.data.url, fileBuffer, {
        headers: {
          'Content-Type': 'audio/mpeg'
        }
      });
      console.log('File uploaded successfully');
    } catch (error) {
      console.error('Error uploading file to pyannote:', error);
      throw new Error('Failed to upload file');
    }

    // התחלת תהליך הזיהוי
    const webhookUrl = `${process.env.URL}/.netlify/functions/diarize-webhook`;
    let diarizeResponse;
    try {
      diarizeResponse = await axios.post('https://api.pyannote.ai/v1/diarize',
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
    } catch (error) {
      console.error('Error starting diarization:', error);
      throw new Error('Failed to start diarization');
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        jobId: diarizeResponse.data.jobId,
        message: 'File uploaded and diarization started'
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
