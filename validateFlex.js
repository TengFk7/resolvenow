require('dotenv').config();
const https = require('https');

const TOKEN = process.env.LINE_CHANNEL_TOKEN;
const ADMIN_ID = process.env.LINE_ADMIN_USER_ID; 

const citizenMessages = [{
  type: 'flex',
  altText: 'test',
  contents: {
    type: 'bubble',
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        { type: 'text', text: 'hello' }
      ]
    }
  }
}];

const body = JSON.stringify({ to: ADMIN_ID, messages: citizenMessages });
const req = https.request({
  hostname: 'api.line.me',
  path: '/v2/bot/message/push',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + TOKEN,
    'Content-Length': Buffer.byteLength(body)
  }
}, (res) => {
  let data = '';
  res.on('data', c => (data += c));
  res.on('end', () => console.log('Status:', res.statusCode, 'Body:', data));
});
req.write(body);
req.end();
