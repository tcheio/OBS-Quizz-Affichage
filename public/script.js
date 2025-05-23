const socket = new WebSocket('ws://localhost:3000');

socket.addEventListener('open', () => {
  console.log('Connecté au serveur WebSocket');
});

socket.addEventListener('error', (error) => {
  console.error('Erreur WebSocket:', error);
});

function sendText(text) {
  if (typeof text === 'string') {
    socket.send(text);
  } else if (typeof text === 'object') {
    socket.send(JSON.stringify(text));
  } else {
    socket.send(String(text));
  }
}



function receiveText(callback) {
  socket.addEventListener('message', (event) => {
    if (event.data instanceof Blob) {
      // Cas très rare mais possible (si serveur envoie du binaire)
      event.data.text().then(txt => {
        callback(txt);
        console.log('Message WebSocket (Blob transformé):', txt);
      });
    } else if (typeof event.data === 'string') {
      callback(event.data);
      console.log('Message WebSocket (texte):', event.data);
    } else {
      // Sécurité ultime (exemple: ArrayBuffer etc)
      try {
        const str = String(event.data);
        callback(str);
        console.log('Message WebSocket (converted):', str);
      } catch(e) {
        console.error('Type de data WebSocket inattendu:', event.data);
      }
    }
  });
}

