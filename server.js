const express = require('express');
const WebSocket = require('ws');
const fs = require('fs');

const app = express();
const port = 3000;

app.use(express.static('public'));
const QUESTIONS_FILE = './data/question.json';
let questions = JSON.parse(fs.readFileSync(QUESTIONS_FILE, 'utf-8'));
let currentIndex = 0;

// Route API pour récupérer une question au hasard
app.get('/api/question/next', (req, res) => {
  if (currentIndex >= questions.length) {
    // Plus de questions
    return res.json({ finished: true });
  }
  const question = questions[currentIndex];
  currentIndex += 1;
  res.json({ question });
});




const server = app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('Client connecté en WebSocket');

  ws.on('message', (message) => {
    console.log(`Message reçu: ${message}`);
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });

  ws.on('close', () => {
    console.log('Client WebSocket déconnecté');
  });
});
