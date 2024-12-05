const crypto = require('crypto');

exports.handler = async function(event, context) {
  console.log('Webhook received:', event.headers, event.body);

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  try {
    // וידוא חתימת Webhook
    const timestamp = event.headers['x-request-timestamp'];
    const signature = event.headers['x-signature'];
    const webhookSecret = process.env.PYANNOTE_WEBHOOK_SECRET;

    const signedContent = `v0:${timestamp}:${event.body}`;
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(signedContent)
      .digest('hex');

    console.log('Expected Signature:', expectedSignature);
    console.log('Received Signature:', signature);

    if (signature !== expectedSignature) {
      console.error('Invalid webhook signature');
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Invalid signature' })
      };
    }

    // קריאת נתוני ה-webhook
    const webhookData = JSON.parse(event.body);
    console.log('Webhook data:', webhookData);

    // אחסון התוצאות בקובץ או במסד נתונים
    // כאן אפשר להוסיף קוד שישמור את התוצאות

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Webhook processed successfully',
        data: webhookData
      })
    };

  } catch (error) {
    console.error('Error processing webhook:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Error processing webhook', details: error.message })
    };
  }
};
