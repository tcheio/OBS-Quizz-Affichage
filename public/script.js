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
      event.data.text().then(txt => {
        callback(txt);
        console.log('Message WebSocket (Blob transformé):', txt);
      });
    } else if (typeof event.data === 'string') {
      callback(event.data);
      console.log('Message WebSocket (texte):', event.data);
    } else {
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

// ----------------------------------------------------------------
// Met ici tout ton code spécifique à l'admin ci-dessous, par exemple :

document.addEventListener('DOMContentLoaded', () => {
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
  const categoriesAvecPropositions = [
    "1 - question5Questions",
    "2 - questionGenerale",
    "4 - questionAuPlusRapide"
  ];
  const thematiqueCategory = "3 - questionThématique";

  const container = document.getElementById('categories');
  const preview = document.getElementById('question-preview');
  const generalControls = document.getElementById('general-controls');
  const thematiqueControls = document.getElementById('thematique-controls');
  const btnShowProps = document.getElementById('show-propositions');
  const btnValidate = document.getElementById('validate');
  const btnRond = document.getElementById('show-rond');
  const btnCarre = document.getElementById('show-carre');
  let lastQuestionData = null;
  let lastCategory = null;

  categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.textContent = cat.replace(/^.*?- /, '').replace('question', '').replace(/([A-Z])/g, ' $1').trim();
    btn.className = "cat-btn";
    btn.onclick = () => {
      fetch('/api/question/next/' + encodeURIComponent(cat))
        .then(r => r.json())
        .then(data => {
          if (data.finished) {
            preview.textContent = "Plus de question disponible dans cette catégorie !";
            sendText("Plus de question disponible dans cette catégorie !");
            generalControls.style.display = "none";
            thematiqueControls.style.display = "none";
            lastQuestionData = null;
          } else if (data && data.question && data.question.texte) {
            preview.textContent = data.question.texte;
            if (
              categoriesAvecPropositions.includes(cat) &&
              Array.isArray(data.question.propositions) &&
              typeof data.question.bonneReponse === "number"
            ) {
              lastQuestionData = data.question;
              lastCategory = cat;
              sendText(JSON.stringify(data.question));
              generalControls.style.display = "block";
              thematiqueControls.style.display = "none";
            }
            else if (cat === thematiqueCategory &&
                  Array.isArray(data.question.propositions) &&
                  typeof data.question.bonneReponse === "number") {
              lastQuestionData = data.question;
              lastCategory = cat;
              sendText(JSON.stringify(data.question));
              generalControls.style.display = "block";
              thematiqueControls.style.display = "block";
            } else {
              sendText(data.question.texte);
              generalControls.style.display = "none";
              thematiqueControls.style.display = "none";
              lastQuestionData = null;
              lastCategory = null;
            }
          }
        });
    };
    container.appendChild(btn);
  });

  btnShowProps.onclick = () => {
    if (lastQuestionData) {
      sendText(JSON.stringify({ action: 'showPropositions' }));
    }
  };
  btnValidate.onclick = () => {
    if (lastQuestionData) {
      sendText(JSON.stringify({ action: 'valider' }));
    }
  };
  if (btnRond) btnRond.onclick = () => {
    if (lastQuestionData) {
      sendText(JSON.stringify({ action: 'showRond' }));
    }
  };
  if (btnCarre) btnCarre.onclick = () => {
    if (lastQuestionData) {
      sendText(JSON.stringify({ action: 'showCarre' }));
    }
  };
  const btnReset = document.getElementById('reset-display');
  if (btnReset) btnReset.onclick = () => {
    sendText("");
    preview.textContent = "";
    generalControls.style.display = "none";
    if (thematiqueControls) thematiqueControls.style.display = "none";
    lastQuestionData = null;
    lastCategory = null;
  };
});