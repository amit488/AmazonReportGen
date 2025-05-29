const express = require('express');
const cors = require('cors');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { GetCommand, PutCommand, DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

const client = new DynamoDBClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const docClient = DynamoDBDocumentClient.from(client);
const USERS_TABLE = process.env.USERS_TABLE;

// Login Route
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const data = await docClient.send(new GetCommand({
      TableName: USERS_TABLE,
      Key: { email },
    }));

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

// Register Route
app.post('/register', async (req, res) => {
  const { email, password } = req.body;

  try {
    const check = await docClient.send(new GetCommand({
      TableName: USERS_TABLE,
      Key: { email },
    }));

    if (check.Item) {
      return res.json({ success: false, message: 'User already exists' });
    }

    await docClient.send(new PutCommand({
      TableName: USERS_TABLE,
      Item: { email, password },
    }));

    res.json({ success: true, message: 'User registered successfully' });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
