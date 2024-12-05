exports.handler = async function(event, context) {
  console.log('Webhook received');
  
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers };
  }

  try {
    const webhookData = JSON.parse(event.body);
    console.log('Webhook data:', webhookData);

    // בדיקת סטטוס העבודה
    if (webhookData.status === 'succeeded') {
      console.log('Diarization succeeded:', webhookData.output);
      
      // כאן אפשר לשמור את התוצאות במסד נתונים או לעשות פעולות נוספות
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          message: 'Webhook processed successfully',
          results: webhookData.output
        })
      };
    } else {
      console.log('Job status:', webhookData.status);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          message: 'Job not completed yet',
          status: webhookData.status
        })
      };
    }

  } catch (error) {
    console.error('Error processing webhook:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Error processing webhook' })
    };
  }
};
