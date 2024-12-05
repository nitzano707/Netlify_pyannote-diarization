const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

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

    if (!event.isBase64Encoded || !event.body) {
      throw new Error('No file was uploaded');
    }

    const fileBuffer = Buffer.from(event.body, 'base64');
    console.log('Received file of size:', fileBuffer.length);

    const objectKey = `audio_${Date.now()}`.replace(/[^a-zA-Z0-9]/g, '');
    const mediaUrl = `media://${objectKey}`;
    console.log('Using media URL:', mediaUrl);

    const filePath = path.join('/tmp', `${objectKey}.mp3`);
    fs.writeFileSync(filePath, fileBuffer);

    const isSupported = await checkAudioFormat(filePath);
    if (!isSupported) {
      throw new Error('Unsupported audio format');
    }

    const fileSizeMB = fs.statSync(filePath).size / (1024 * 1024);
    if (fileSizeMB > 10) {
      console.log('Compressing file to reduce size');
      await compressFile(filePath);
    }

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

    await axios.put(response.data.url, fs.createReadStream(filePath), {
      headers: {
        'Content-Type': 'audio/mpeg'
      }
    });

    console.log('File uploaded successfully');

    const webhookUrl = `${process.env.URL}/.netlify/functions/diarize-webhook`;
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

// פונקציה בודקת אם הפורמט של הקובץ נתמך
async function checkAudioFormat(filePath) {
  const supportedFormats = ['mp3', 'wav', 'm4a'];
  const fileExtension = path.extname(filePath).toLowerCase().slice(1);  // מקבל את הסיומת של הקובץ

  if (supportedFormats.includes(fileExtension)) {
    console.log('Supported audio format:', fileExtension);
    return true;
  } else {
    console.error('Unsupported audio format:', fileExtension);
    return false;
  }
}
