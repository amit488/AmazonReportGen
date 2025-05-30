const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const {
  DynamoDBClient,
} = require('@aws-sdk/client-dynamodb');
const {
  GetCommand,
  PutCommand,
  DynamoDBDocumentClient,
} = require('@aws-sdk/lib-dynamodb');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

// AWS Clients
const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const USERS_TABLE = process.env.USERS_TABLE;
const UPLOADS_TABLE = process.env.UPLOADS_TABLE;

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// ---------------- LOGIN ----------------
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const data = await docClient.send(
      new GetCommand({
        TableName: USERS_TABLE,
        Key: { email },
      })
    );

    if (!data.Item) {
      return res.json({ success: false, message: 'User not found' });
    }

    if (data.Item.password === password) {
      res.json({ success: true, message: 'Login successful' });
    } else {
      res.json({ success: false, message: 'Incorrect password' });
    }
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ---------------- REGISTER ----------------
app.post('/register', async (req, res) => {
  const { email, password } = req.body;

  try {
    const check = await docClient.send(
      new GetCommand({
        TableName: USERS_TABLE,
        Key: { email },
      })
    );

    if (check.Item) {
      return res.json({ success: false, message: 'User already exists' });
    }

    await docClient.send(
      new PutCommand({
        TableName: USERS_TABLE,
        Item: { email, password },
      })
    );

    res.json({ success: true, message: 'User registered successfully' });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ---------------- GET PRESIGNED URL ----------------
app.post('/get-presigned-url', async (req, res) => {
  const { filename, email } = req.body;

  if (!filename || !email || !filename.endsWith('.csv')) {
    return res.status(400).json({ error: 'Invalid file or email' });
  }

  const key = `uploads/${filename}`;

  try {
    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      ContentType: 'text/csv',
    });

    const url = await getSignedUrl(s3, command, { expiresIn: 300 });
    const timestamp = new Date().toISOString();

    return res.json({ url, timestamp });
  } catch (err) {
    console.error('Presigned URL error:', err);
    return res.status(500).json({ error: 'Failed to generate URL' });
  }
});

// ---------------- LOG METADATA TO DYNAMODB ----------------
app.post('/log-upload', async (req, res) => {
  const { filename, email, timestamp } = req.body;

  if (!filename || !email || !timestamp) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  try {
    await docClient.send(
      new PutCommand({
        TableName: UPLOADS_TABLE,
        Item: {
          email,
          filename,
          timestamp,
        },
      })
    );

    return res.json({ success: true });
  } catch (err) {
    console.error('DynamoDB log error:', err);
    return res.status(500).json({ error: 'Failed to log upload' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
