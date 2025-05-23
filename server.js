const express = require('express');
const WebSocket = require('ws');
const fs = require('fs');

const app = express();
const port = 3000;

app.use(express.static('public'));

// Route API pour récupérer une question au hasard
app.get('/api/question/random', (req, res) => {
  const questions = JSON.parse(fs.readFileSync('./data/question.json', 'utf-8'));
  const randomQuestion = questions[Math.floor(Math.random() * questions.length)];
  res.json({ question: randomQuestion });
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
