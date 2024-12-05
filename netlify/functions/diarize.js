const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process'); // עבור המרת פורמטים ודחיסת קבצים

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

    // בדיקה אם קיבלנו קובץ
    if (!event.isBase64Encoded || !event.body) {
      throw new Error('No file was uploaded');
    }

    // המרת הקובץ מ-base64
    const fileBuffer = Buffer.from(event.body, 'base64');
    console.log('Received file of size:', fileBuffer.length);

    // יצירת מזהה ייחודי
    const objectKey = `audio_${Date.now()}`.replace(/[^a-zA-Z0-9]/g, '');
    const mediaUrl = `media://${objectKey}`;
    console.log('Using media URL:', mediaUrl);

    // שמירת הקובץ לדיסק לטיפול נוסף
    const filePath = path.join('/tmp', `${objectKey}.mp3`);
    fs.writeFileSync(filePath, fileBuffer);

    // בדיקה אם הפורמט נתמך
    const isSupported = await checkAudioFormat(filePath);
    if (!isSupported) {
      throw new Error('Unsupported audio format');
    }

    // דחיסת הקובץ אם הוא גדול מדי
    const maxSizeMB = 10; // 10MB
    const fileSizeMB = fs.statSync(filePath).size / (1024 * 1024);
    if (fileSizeMB > maxSizeMB) {
      console.log('Compressing file to reduce size');
      await compressFile(filePath);
    }

    // העלאת הקובץ
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

    // העלאת הקובץ ל-pyannote
    await axios.put(response.data.url, fs.createReadStream(filePath), {
      headers: {
        'Content-Type': 'audio/mpeg'
      }
    });

    console.log('File uploaded successfully');

    // התחלת תהליך זיהוי הדוברים
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

// פונקציה לבדוק אם הפורמט נתמך
async function checkAudioFormat(filePath) {
  const allowedFormats = ['mp3', 'wav', 'm4a'];
  const fileExtension = path.extname(filePath).slice(1);
  return allowedFormats.includes(fileExtension);
}

// פונקציה לדחיסת קובץ אם הוא גדול מדי
async function compressFile(filePath) {
  return new Promise((resolve, reject) => {
    const compressedFilePath = filePath.replace('.mp3', '-compressed.mp3');
    exec(`ffmpeg -i ${filePath} -b:a 128k ${compressedFilePath}`, (error, stdout, stderr) => {
      if (error) {
        console.error('Error compressing file:', error);
        reject(error);
      }
      console.log('File compressed:', compressedFilePath);
      fs.unlinkSync(filePath); // מחיקת הקובץ הלא דחוס
      fs.renameSync(compressedFilePath, filePath); // החלפתו בקובץ הדחוס
      resolve();
    });
  });
}
