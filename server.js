require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const cors = require('cors');
const nodemailer = require('nodemailer');
const path = require('path');
const fetch = require('node-fetch'); // Required for calling the Ollama API
const Score = require('./models/Score');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.log('Mongo error:', err));

// Save Score API
app.post('/api/save-score', async (req, res) => {
  const { grade, strand, file, date, score, total } = req.body;
  try {
    await Score.create({ grade, strand, file, date, score, total });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Get Scores API
app.get('/api/get-scores', async (req, res) => {
  try {
    const scores = await Score.find({}).sort({ date: -1 });
    res.json(scores);
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Send Email API
app.post('/api/send-email', async (req, res) => {
  const { name, email, message } = req.body;
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
  const mailOptions = {
    from: email,
    to: process.env.EMAIL_USER,
    subject: `QuizEase Feedback from ${name}`,
    text: message
  };
  try {
    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: "Email sent successfully!" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to send email." });
  }
});

// Generate Quiz API (Ollama Integration)
app.post('/api/generate-quiz', async (req, res) => {
  const { moduleText } = req.body; // The lesson/module text sent from the frontend
  const ollamaUrl = 'http://localhost:11434/api/generate'; // Ollama's local API endpoint

  // Define the prompt to send to Ollama
  const prompt = `Generate 5 multiple-choice quiz questions based on the following lesson/module. 
Each question should have 4 choices and the correct answer should be indicated by its index. 
Return the result as a JSON array like this: 
[{"question": "Question text", "choices": ["A", "B", "C", "D"], "answer": 0}]. 
Lesson/module content: ${moduleText}`;

  try {
    // Call Ollama's local API
    const ollamaResponse = await fetch(ollamaUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'mistral', prompt }) // Replace 'mistral' with your chosen model
    });

    const ollamaData = await ollamaResponse.json();
    console.log("Ollama Response:", ollamaData);

    const responseText = ollamaData.response;
    const jsonStart = responseText.indexOf('[');
    const jsonEnd = responseText.lastIndexOf(']') + 1;
    
    const match = ollamaData.response.match(/\[.*\]/s); // Match JSON array in the response
    if (match) {
      const quizQuestions = JSON.parse(match[0]);
      res.json(quizQuestions);
    } else {
      res.status(500).json({ error: "Failed to parse quiz questions from the model response." });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Catch-All Route (for SPA frontend)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));