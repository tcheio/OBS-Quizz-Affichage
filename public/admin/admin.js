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
    '1 - questionsBasiques',
    '2.1 - questionsThemeTV',
    '2.2 - questionsThemeCinema',
    '2.3 - questionsThemeChansonFR',
    '2.4 - questionsThemePolitique',
    '2.5 - questionsThemeHistoireFR',
    '2.6 - questionsThemeAnime2025',
    '2.7 - questionsThemeCuisine',
    '2.8 - questionsThemeSport',
    '3.1 - placement',
    '4 - questionAuPlusRapide',
    '5 - questionFinale'
  ];

  // 🔹 Fallback au cas où la catégorie n'a pas de handler déclaré
  const noControls = () => ({ controls: {} });

  // Mapping "catégorie -> type de quiz"
  const registry = {
    '1 - questionsBasiques':     withPropositions,
    '2.1 - questionsThemeTV':     thematique,
    '2.2 - questionsThemeCinema':     thematique,
    '2.3 - questionsThemeChansonFR':     thematique,
    '2.4 - questionsThemePolitique':     thematique,
    '2.5 - questionsThemeHistoireFR':     thematique,
    '2.6 - questionsThemeAnime2025':     thematique,
    '2.7 - questionsThemeCuisine':     thematique,
    '2.8 - questionsThemeSport':     thematique,
    '3.1 - placement':           withPropositions,
    '4 - questionAuPlusRapide':  withPropositions,
    '5 - questionFinale':        finale,
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

  // Boutons de sélection A/B/C/D (déjà dans ton HTML)
  const selectionButtons   = document.getElementById('selection-buttons');
  const btnA = document.getElementById('a');
  const btnB = document.getElementById('b');
  const btnC = document.getElementById('c');
  const btnD = document.getElementById('d');

  // Caché au départ
  if (selectionButtons) selectionButtons.style.display = 'none';

  // ⚠️ liste déroulante de thème (optionnelle)
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
  // Suivi du mode d'affichage courant: 'none' | 'props' | 'rond' | 'carre'
  let displayState     = 'none';

  // Contexte partagé pour les handlers
  const handlerContext = { sendText };

  // Helpers d’affichage des boutons de sélection
  function showSelection(count) {
    if (!selectionButtons) return;
    selectionButtons.style.display = 'block';
    // A & B toujours visibles
    if (btnA) btnA.style.display = 'inline-block';
    if (btnB) btnB.style.display = 'inline-block';
    // C & D selon count
    if (btnC) btnC.style.display = count >= 3 ? 'inline-block' : 'none';
    if (btnD) btnD.style.display = count >= 4 ? 'inline-block' : 'none';
  }
  function hideSelection() {
    if (selectionButtons) selectionButtons.style.display = 'none';
  }

  function applyControlsDisplay(controls) {
    // Sécurise si module ne précise rien
    const c = controls || { general: false, thematique: false, showProps: false };

    generalControls.style.display    = c.general    ? 'block'       : 'none';
    thematiqueControls.style.display = c.thematique ? 'block'       : 'none';
    btnShowProps.style.display       = c.showProps  ? 'inline-block': 'none';

    // Re-cache la sélection à chaque changement d'état/chargement de question
    hideSelection();
    // Quand on change d'état, on repart en "aucun mode d'affichage"
    displayState = 'none';
  }

  function setButtonsBindings() {
    // Nettoie les anciens écouteurs en écrasant directement onclick
    btnShowProps.onclick = null;
    btnValidate.onclick  = null;
    if (btnRond)  btnRond.onclick  = null;
    if (btnCarre) btnCarre.onclick = null;

    if (!currentHandler) return;

    // Affichage des propositions (mode standard)
    if (currentHandler.showProps) {
      btnShowProps.onclick = () => {
        if (lastQuestionData) currentHandler.showProps();
        // ➜ 4 choix visibles
        showSelection(4);
        displayState = 'props';
        console.log('[ADMIN] Mode défini via "Afficher les propositions" → displayState =', displayState);
      };
    }
    if (currentHandler.validate) {
  btnValidate.onclick = () => {
    console.group('[ADMIN] Clic sur "Valider"');
    console.log('→ hasQuestion:', !!lastQuestionData, 'category:', lastCategory);
    console.log('→ displayState avant validation:', displayState);

    if (!lastQuestionData) {
      console.warn('✖ Abandon: aucune question chargée.');
      console.groupEnd();
      return;
    }

    if (displayState === 'none') {
      // ✅ Validation "sans affichage" : on demande directement la validation à l’overlay.
      // L’overlay (obs.js) montrera la bonne réponse seule.
      console.log('⚠ Aucun mode affiché → envoi direct {action:"validate"} à l’overlay.');
      sendText({ action: 'validate' }); // (ou: { action: 'valider' })
      console.groupEnd();
      return;
    }

    // Modes props/rond/carré → on délègue au handler (comportement normal)
    try {
      currentHandler.validate();
      console.log('✓ Appel currentHandler.validate() OK.');
    } catch (e) {
      console.error('✖ Exception pendant currentHandler.validate():', e);
    }
    console.groupEnd();
  };
}

    if (btnRond && currentHandler.rond) {
      btnRond.onclick = () => {
        if (!lastQuestionData) return;
        currentHandler.rond();
        // ➜ ROND = 2 choix visibles (A/B)
        showSelection(2);
        displayState = 'rond';
        console.log('[ADMIN] Mode défini via "Rond" → displayState =', displayState);
      };
    }
    if (btnCarre && currentHandler.carre) {
      btnCarre.onclick = () => {
        if (!lastQuestionData) return;
        currentHandler.carre();
        // ➜ CARRÉ = 4 choix visibles (A/B/C/D)
        showSelection(4);
        displayState = 'carre';
        console.log('[ADMIN] Mode défini via "Carré" → displayState =', displayState);
      };
    }
  }

  // Envoi de la sélection A/B/C/D (A→0, B→1, C→2, D→3)
  const sendSelection = (pos) => {
    if (!lastQuestionData || !Array.isArray(lastQuestionData.propositions)) return;
    sendText({ action: 'select', pos }); // OBS s'occupe de l'affichage
  };
  if (btnA) btnA.onclick = () => sendSelection(0);
  if (btnB) btnB.onclick = () => sendSelection(1);
  if (btnC) btnC.onclick = () => sendSelection(2);
  if (btnD) btnD.onclick = () => sendSelection(3);

  // Création des boutons catégorie
  categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.textContent = cat.replace(/^.*?- /, '')
                         .replace('questions', '')
                         .replace(/([A-Z])/g, ' $1')
                         .trim();
    btn.className = 'cat-btn';

    btn.onclick = () => {
      console.group('[ADMIN] Demande de nouvelle question');
      console.log('→ Catégorie demandée:', cat);
      fetch('/api/question/next/' + encodeURIComponent(cat))
        .then(r => r.json())
        .then(data => {
          if (data.finished) {
            console.warn('✖ Plus de question disponible dans cette catégorie');
            preview.textContent = 'Plus de question disponible dans cette catégorie !';
            sendText('Plus de question disponible dans cette catégorie !');
            lastQuestionData = null;
            lastCategory = null;
            currentHandler = null;
            applyControlsDisplay(); // tout masque (+ re-cache sélection)
            setButtonsBindings();
            console.groupEnd();
            return;
          }

          if (data && data.question && data.question.texte) {
            lastQuestionData = data.question;
            lastCategory = cat;
            preview.textContent = data.question.texte;
            console.log('✓ Question reçue:', {
              categorie: cat,
              aPropositions: Array.isArray(data.question.propositions),
              bonneReponse: data.question.bonneReponse,
              id: data.question.id ?? '(sans id)',
            });

            // Envoie la question brute vers OBS
            sendText(JSON.stringify(data.question));
            console.log('→ Question envoyée à OBS via WebSocket.');

            // Instancie le handler correspondant
            const factory = registry[cat] || noControls;
            currentHandler = factory(handlerContext);
            console.log('→ Handler instancié:', currentHandler ? 'OK' : 'NULL');

            // Affiche/Masque l'UI selon le type (et re-cache sélection)
            applyControlsDisplay(currentHandler.controls);
            setButtonsBindings();
            // À la réception d'une nouvelle question, aucun mode choisi
            displayState = 'none';
            console.log('→ displayState réinitialisé =', displayState);
          } else {
            console.error('✖ Payload question inattendu:', data);
          }
          console.groupEnd();
        })
        .catch(err => {
          console.error('Erreur fetch question:', err);
          console.groupEnd();
        });
    };

    container.appendChild(btn);
  });

  // Bouton reset affichage
  if (btnReset) {
    btnReset.onclick = () => {
      console.log('[ADMIN] Reset affichage demandé.');
      sendText('');
      preview.textContent = '';
      lastQuestionData = null;
      lastCategory = null;
      currentHandler = null;
      applyControlsDisplay(); // masque tout + re-cache sélection
      setButtonsBindings();
      displayState = 'none';
      console.log('→ displayState =', displayState);
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


/* ==================== Gestion des 2 Chronos (dégressifs) ==================== */
const chronoLeft = {
  interval: null,
  time: 60,  // 60 secondes = 1 minute
  running: false,
  duration: 60
};
const chronoRight = {
  interval: null,
  time: 60,
  running: false,
  duration: 60
};

// helper format mm:ss
const formatTime = (t) => {
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

// mise à jour (envoi à l’overlay)
const updateOverlay = (side) => {
  const c = side === 'left' ? chronoLeft : chronoRight;
  sendText({ action: 'chronoUpdate', side, time: c.time, running: c.running });
};

const startChrono = (side) => {
  const c = side === 'left' ? chronoLeft : chronoRight;
  if (c.running) return;
  c.running = true;

  c.interval = setInterval(() => {
    if (c.time > 0) {
      c.time--;
      updateOverlay(side);
    } else {
      // fin du chrono
      clearInterval(c.interval);
      c.running = false;
      c.time = 0;
      updateOverlay(side);
      // petit bip facultatif :
      // sendText({ action: 'chronoEnd', side });
    }
  }, 1000);
  updateOverlay(side);
};

const pauseChrono = (side) => {
  const c = side === 'left' ? chronoLeft : chronoRight;
  if (!c.running) return;
  c.running = false;
  clearInterval(c.interval);
  updateOverlay(side);
};

const resetChrono = (side) => {
  const c = side === 'left' ? chronoLeft : chronoRight;
  c.running = false;
  clearInterval(c.interval);
  c.time = c.duration; // remet à 60s
  updateOverlay(side);
};

// boutons
document.getElementById('chrono-left-start')?.addEventListener('click', () => startChrono('left'));
document.getElementById('chrono-left-pause')?.addEventListener('click', () => pauseChrono('left'));
document.getElementById('chrono-left-reset')?.addEventListener('click', () => resetChrono('left'));
document.getElementById('chrono-right-start')?.addEventListener('click', () => startChrono('right'));
document.getElementById('chrono-right-pause')?.addEventListener('click', () => pauseChrono('right'));
document.getElementById('chrono-right-reset')?.addEventListener('click', () => resetChrono('right'));
// === Toggle affichage des chronos sur OBS ===
let chronosVisible = true;

document.getElementById('chrono-toggle-display')?.addEventListener('click', () => {
  chronosVisible = !chronosVisible;
  sendText({ action: 'chronoToggleDisplay', visible: chronosVisible });
  console.log(`[ADMIN] Chronos ${chronosVisible ? 'affichés' : 'cachés'} sur OBS.`);
});


});
