// ==================== WebSocket ====================
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
      } catch (e) {
        console.error('Type de data WebSocket inattendu:', event.data);
      }
    }
  });
}

// ==================== Imports des types ====================
// IMPORTANT: ce fichier doit être chargé en <script type="module">
import { withPropositions } from './quizz/withPropositions.js';
import { thematique }       from './quizz/thematique.js';
import { finale }           from './quizz/finale.js';

// ==================== App ====================
document.addEventListener('DOMContentLoaded', () => {
  // Catégories telles que dans /data
const categories = [
  '1 - question5Questions',
  '2.1 - questionsThemeX',
  '2.2 - questionsThemeY',
  '3.1 - QuizzQuiveutGagnerM',
  '4 - questionAuPlusRapide',
  '5 - questionFinale'
];

  // Mapping "catégorie -> type de quiz"
  const registry = {
    '1 - questionsBasiques':   withPropositions,
    '2.1 - questionsThemeX':     thematique,
    '2.2 - questionsThemeY':     thematique,
    '3.1 - QuizzQuiveutGagnerM': withPropositions,
    '4 - questionAuPlusRapide': withPropositions,
    '5 - questionFinale':       finale,
  };

  // Références DOM
  const container          = document.getElementById('categories');
  const preview            = document.getElementById('question-preview');
  const generalControls    = document.getElementById('general-controls');
  const thematiqueControls = document.getElementById('thematique-controls');
  const btnShowProps       = document.getElementById('show-propositions');
  const btnValidate        = document.getElementById('validate');
  const btnRond            = document.getElementById('show-rond');
  const btnCarre           = document.getElementById('show-carre');
  const btnReset           = document.getElementById('reset-display');

  // ⚠️ Ajout minimal : liste déroulante de thème (optionnelle)
  const themeSelect = document.getElementById('theme-select');
  if (themeSelect) {
    themeSelect.addEventListener('change', () => {
      const theme = themeSelect.value; // ex: 'violet' | 'orange'
      sendText({ action: 'setTheme', theme });
    });
  }

  // État courant
  let lastQuestionData = null;
  let lastCategory     = null;
  let currentHandler   = null; // handler du type actif

  // Contexte partagé pour les handlers
  const handlerContext = { sendText };

  function applyControlsDisplay(controls) {
    // Sécurise si module ne précise rien
    const c = controls || { general: false, thematique: false, showProps: false };

    generalControls.style.display    = c.general    ? 'block'       : 'none';
    thematiqueControls.style.display = c.thematique ? 'block'       : 'none';
    btnShowProps.style.display       = c.showProps  ? 'inline-block': 'none';
  }

  function setButtonsBindings() {
    // Nettoie les anciens écouteurs en écrasant directement onclick
    btnShowProps.onclick = null;
    btnValidate.onclick  = null;
    if (btnRond)  btnRond.onclick  = null;
    if (btnCarre) btnCarre.onclick = null;

    if (!currentHandler) return;

    // Bind uniquement si la méthode existe
    if (currentHandler.showProps) {
      btnShowProps.onclick = () => { if (lastQuestionData) currentHandler.showProps(); };
    }
    if (currentHandler.validate) {
      btnValidate.onclick = () => { if (lastQuestionData) currentHandler.validate(); };
    }
    if (btnRond && currentHandler.rond) {
      btnRond.onclick = () => { if (lastQuestionData) currentHandler.rond(); };
    }
    if (btnCarre && currentHandler.carre) {
      btnCarre.onclick = () => { if (lastQuestionData) currentHandler.carre(); };
    }
  }

  // Création des boutons catégorie
  categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.textContent = cat.replace(/^.*?- /, '')
                         .replace('question', '')
                         .replace(/([A-Z])/g, ' $1')
                         .trim();
    btn.className = 'cat-btn';

    btn.onclick = () => {
      fetch('/api/question/next/' + encodeURIComponent(cat))
        .then(r => r.json())
        .then(data => {
          if (data.finished) {
            preview.textContent = 'Plus de question disponible dans cette catégorie !';
            sendText('Plus de question disponible dans cette catégorie !');
            lastQuestionData = null;
            lastCategory = null;
            currentHandler = null;
            applyControlsDisplay(); // tout masque
            setButtonsBindings();
            return;
          }

          if (data && data.question && data.question.texte) {
            preview.textContent = data.question.texte;
            lastQuestionData = data.question;
            lastCategory = cat;

            // Envoie la question brute vers OBS
            sendText(JSON.stringify(data.question));

            // Instancie le handler correspondant
            const factory = registry[cat] || noControls;
            currentHandler = factory(handlerContext);

            // Affiche/Masque l'UI selon le type
            applyControlsDisplay(currentHandler.controls);
            setButtonsBindings();
          }
        })
        .catch(err => {
          console.error('Erreur fetch question:', err);
        });
    };

    container.appendChild(btn);
  });

  // Bouton reset affichage
  if (btnReset) {
    btnReset.onclick = () => {
      sendText('');
      preview.textContent = '';
      lastQuestionData = null;
      lastCategory = null;
      currentHandler = null;
      applyControlsDisplay(); // masque tout
      setButtonsBindings();
    };
  }

  // Lien OBS (copie presse-papier)
  const obsUrl = `${location.origin}/obs/obs.html`;
  const copyObsLink = document.getElementById('copy-obs-link');
  if (copyObsLink) {
    copyObsLink.onclick = function (e) {
      e.preventDefault();
      navigator.clipboard.writeText(obsUrl).then(() => {
        this.textContent = 'Lien copié !';
        setTimeout(() => (this.textContent = 'Copier le lien OBS'), 1300);
      });
    };
  }
});
