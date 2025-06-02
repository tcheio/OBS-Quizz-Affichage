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
      event.data.text().then(txt => callback(txt));
    } else if (typeof event.data === 'string') {
      callback(event.data);
    } else {
      try {
        callback(String(event.data));
      } catch(e) {
        console.error('Type de data WebSocket inattendu:', event.data);
      }
    }
  });
}

// ----------------------------------------------------------------

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
    "4 - questionAuPlusRapide",
    "6 - questionClassement",
    "7 - questionAuPlusLoin",
    "8 - questionFinale"
  ];
  const thematiqueCategory = "3 - questionThématique";
  const finaleCategory = "8 - questionFinale";

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

  function updateControlsDisplay(cat) {
    if (cat === thematiqueCategory) {
      generalControls.style.display = "block";
      thematiqueControls.style.display = "block";
      btnShowProps.style.display = "none";
    }
    else if (categoriesAvecPropositions.includes(cat)) {
      generalControls.style.display = "block";
      thematiqueControls.style.display = "none";
      btnShowProps.style.display = "inline-block";
    }
    else if (cat === finaleCategory) {
      generalControls.style.display = "block";
      thematiqueControls.style.display = "none";
      btnShowProps.style.display = "none";
    }
    else {
      generalControls.style.display = "none";
      thematiqueControls.style.display = "none";
      btnShowProps.style.display = "none";
    }
  }

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
            updateControlsDisplay(null);
            lastQuestionData = null;
          } else if (data && data.question && data.question.texte) {
            preview.textContent = data.question.texte;
            lastQuestionData = data.question;
            lastCategory = cat;
            sendText(JSON.stringify(data.question));
            updateControlsDisplay(cat);
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
    updateControlsDisplay(null);
    lastQuestionData = null;
    lastCategory = null;
  };

  // Gestion des liens en bas de page
  const obsUrl = `${location.origin}/obs/obs.html`;
  document.getElementById('copy-obs-link').onclick = function(e) {
    e.preventDefault();
    navigator.clipboard.writeText(obsUrl).then(() => {
      this.textContent = "Lien copié !";
      setTimeout(() => this.textContent = "Copier le lien OBS", 1300);
    });
  };
});
