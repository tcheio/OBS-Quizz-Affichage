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
    // Si c'est un Blob, on le transforme en texte
    if (event.data instanceof Blob) {
      event.data.text().then(txt => {
        callback(txt);
        console.log('Blob transformé en texte :', txt);
      });
    } else {
      callback(event.data);
      console.log('Message reçu sur OBS :', event.data, 'Type:', typeof event.data);
    }
  });
}

