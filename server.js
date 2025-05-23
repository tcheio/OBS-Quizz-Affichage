const express = require('express');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;

app.use(express.static('public'));

// Liste des catégories/fichiers (mets ici tes noms SANS extension)
const categories = [
  '1 - question5Questions',
  '2 - questionGenerale',
  '3 - questionThématique',
  '4 - questionAuPlusRapide',
  '5 - questionIdentification',
  '6 - questionClassement',
  '7 - questionAuPlusLoin',
  '8 - questionFinale'
];

// Charge les questions par catégorie en mémoire
let questionsByCategory = {};
let currentIndexByCategory = {};

categories.forEach(cat => {
  const filepath = path.join(__dirname, `./data/${cat}.json`);
  if (fs.existsSync(filepath)) {
    questionsByCategory[cat] = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
    currentIndexByCategory[cat] = 0;
  } else {
    questionsByCategory[cat] = [];
    currentIndexByCategory[cat] = 0;
  }
});

// Route API générique : question suivante dans la catégorie
app.get('/api/question/next/:cat', (req, res) => {
  const cat = req.params.cat;
  if (!categories.includes(cat)) {
    return res.status(404).json({ error: 'Catégorie inconnue' });
  }
  const questions = questionsByCategory[cat];
  const idx = currentIndexByCategory[cat];

  if (idx >= questions.length) {
    return res.json({ finished: true });
  }
  const question = questions[idx];
  currentIndexByCategory[cat]++;
  res.json({ question });
});

// Optionnel : reset d'une catégorie
app.post('/api/question/reset/:cat', (req, res) => {
  const cat = req.params.cat;
  if (categories.includes(cat)) {
    currentIndexByCategory[cat] = 0;
    res.json({ reset: true });
  } else {
    res.status(404).json({ error: 'Catégorie inconnue' });
  }
});

const server = app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('Client connecté en WebSocket');

  ws.on('message', (message) => {
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });
});
