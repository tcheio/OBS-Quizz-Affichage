const socket = new WebSocket('ws://localhost:3000');
const quizzContainer = document.getElementById('quizz-container');
const questionBox = document.getElementById('question-box');
const answersRow = document.getElementById('answers-row');
const bonneSeule = document.getElementById('bonne-seule');
const letters = ["A", "B", "C", "D"];

let currentQuestion = null;
let thematiqueMode = null;      // null | 'rond' | 'carre'
let thematiqueIndexes = null;   // mapping indices question -> positions affichées (rond/carré)
let modeFinale = false;
let hideTimeout = null;
let fadeoutTimeout = null;

// NEW: position sélectionnée à l'écran (0..3 ou 0..1 pour rond)
let selectedPos = null;

// --- Changement de thème CSS ---
function applyTheme(themeName) {
  const link = document.getElementById('theme-css');
  if (!link) return;
  const safe = (themeName === 'orange') ? 'orange' : 'violet';
  const href = `./themes/obs-${safe}.css?v=${Date.now()}`;
  link.setAttribute('href', href);
}

function resetDisplay() {
  quizzContainer.classList.remove("visible", "fadeout");
  questionBox.textContent = "";
  questionBox.classList.remove("visible");

  answersRow.innerHTML = "";
  answersRow.className = "";

  bonneSeule.textContent = "";
  bonneSeule.className = "";
  bonneSeule.style.visibility = "hidden";
  bonneSeule.style.opacity = 0;

  thematiqueMode = null;
  thematiqueIndexes = null;
  modeFinale = false;
  selectedPos = null;
}

function hideQuizContainer(smooth = true) {
  clearTimeout(fadeoutTimeout);
  if (smooth) {
    quizzContainer.classList.remove("visible");
    quizzContainer.classList.add("fadeout");
    fadeoutTimeout = setTimeout(() => {
      quizzContainer.classList.remove("fadeout");
      resetDisplay();
    }, 800);
  } else {
    resetDisplay();
  }
}

function receiveText(callback) {
  socket.addEventListener('message', (event) => {
    if (event.data instanceof Blob) {
      event.data.text().then(txt => callback(txt));
    } else if (typeof event.data === 'string') {
      callback(event.data);
    } else {
      try { callback(String(event.data)); }
      catch { /* noop */ }
    }
  });
}

function shuffle(array) {
  let arr = array.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function clearAnswerClasses() {
  answersRow.querySelectorAll('.answer-block').forEach(b => {
    b.classList.remove('selected', 'wrong', 'bonne', 'visible');
    // on garde visible pour l'anim ensuite
    b.classList.add('visible');
  });
}

function markSelected(pos) {
  const blocks = answersRow.querySelectorAll('.answer-block');
  // Nettoie puis applique la sélection
  blocks.forEach((b, i) => {
    b.classList.toggle('selected', i === pos);
    b.classList.remove('wrong', 'bonne');
  });
  selectedPos = pos;
}

function renderPropositions(propositions, indexes) {
  answersRow.innerHTML = "";
  answersRow.className = "dynamic-" + indexes.length;

  bonneSeule.textContent = "";
  bonneSeule.className = "";
  bonneSeule.style.visibility = "hidden";
  bonneSeule.style.opacity = 0;

  selectedPos = null;

  indexes.forEach((qi, shownPos) => {
    const block = document.createElement('div');
    block.className = "answer-block";
    const label = document.createElement('span');
    label.className = "answer-label";
    label.textContent = letters[shownPos] + ".";
    const txt = document.createElement('span');
    txt.className = "answer-text";
    txt.textContent = propositions[qi];
    block.appendChild(label);
    block.appendChild(txt);
    answersRow.appendChild(block);
    setTimeout(() => block.classList.add('visible'), 90 * shownPos + 100);
  });
}

receiveText((msg) => {
  clearTimeout(hideTimeout);

  if (!msg || msg.trim() === "") {
    hideQuizContainer(true);
    currentQuestion = null;
    return;
  }

  let data;
  try { data = JSON.parse(msg); }
  catch {
    // message texte brut : affiche dans la boîte question (comportement existant)
    questionBox.textContent = msg;
    quizzContainer.classList[msg.trim() !== "" ? "add" : "remove"]("visible");
    resetDisplay();
    return;
  }

  // 0) Changement de thème
  if (data.action === 'setTheme') {
    applyTheme(data.theme);
    return;
  }

  // 1) Sélection reçue depuis l'admin (A/B/C/D => pos)
  if (data.action === 'select' && typeof data.pos === 'number') {
    const blocks = answersRow.querySelectorAll('.answer-block');
    if (blocks.length > 0) {
      const pos = Math.max(0, Math.min(data.pos|0, blocks.length - 1));
      markSelected(pos); // bleu clair
    }
    return;
  }

  // 2) Question finale (texte + réponse unique)
  if (data.texte && data.reponse && !data.propositions) {
    currentQuestion = data;
    modeFinale = true;
    thematiqueMode = null;
    thematiqueIndexes = null;
    selectedPos = null;

    questionBox.textContent = data.texte;
    quizzContainer.classList.add("visible");
    quizzContainer.classList.remove("fadeout");
    setTimeout(() => questionBox.classList.add("visible"), 70);

    answersRow.innerHTML = "";
    answersRow.className = "dynamic-1";

    bonneSeule.textContent = "";
    bonneSeule.className = "";
    bonneSeule.style.visibility = "hidden";
    bonneSeule.style.opacity = 0;
    return;
  } else {
    modeFinale = false;
  }

  // 3) Nouvelle question à choix
  if (data.texte && Array.isArray(data.propositions)) {
    currentQuestion = data;
    thematiqueMode = null;
    thematiqueIndexes = null;
    selectedPos = null;

    questionBox.textContent = data.texte;
    quizzContainer.classList.add("visible");
    quizzContainer.classList.remove("fadeout");
    setTimeout(() => questionBox.classList.add("visible"), 70);

    // prépare 4 blocs vides (affichage standard, rempli ensuite par showPropositions)
    answersRow.innerHTML = "";
    answersRow.className = "dynamic-4";
    for (let i = 0; i < 4; i++) {
      const block = document.createElement('div');
      block.className = "answer-block";
      block.innerHTML = `<span class="answer-label">${letters[i]}.</span><span class="answer-text"></span>`;
      answersRow.appendChild(block);
    }

    bonneSeule.textContent = "";
    bonneSeule.className = "";
    bonneSeule.style.visibility = "hidden";
    bonneSeule.style.opacity = 0;
  }

  // 4) Modes thématiques
  if (data.action === 'showRond' && currentQuestion) {
    thematiqueMode = 'rond';
    const idxs = [currentQuestion.bonneReponse];
    const bads = shuffle([0,1,2,3].filter(i => i !== currentQuestion.bonneReponse));
    idxs.push(bads[0]);
    thematiqueIndexes = shuffle(idxs);
    renderPropositions(currentQuestion.propositions, thematiqueIndexes);
    answersRow.className = "dynamic-2";
  }

  if (data.action === 'showCarre' && currentQuestion) {
    thematiqueMode = 'carre';
    thematiqueIndexes = [0,1,2,3];
    renderPropositions(currentQuestion.propositions, thematiqueIndexes);
    answersRow.className = "dynamic-4";
  }

  // 5) Affichage standard des propositions (hors thématique)
  if (data.action === 'showPropositions' && currentQuestion && !thematiqueMode) {
    thematiqueIndexes = [0,1,2,3];           // affichage dans l'ordre A/B/C/D
    renderPropositions(currentQuestion.propositions, thematiqueIndexes);
    answersRow.className = "dynamic-4";
  }

  // 6) Validation
  if (data.action === 'valider' && currentQuestion) {
    const blocks = answersRow.querySelectorAll('.answer-block');

    // finale → on affiche la réponse seule
    if (modeFinale && currentQuestion.reponse) {
      answersRow.innerHTML = "";
      answersRow.className = "dynamic-1";
      bonneSeule.textContent = currentQuestion.reponse;
      bonneSeule.className = "visible";
      bonneSeule.style.visibility = "visible";
      bonneSeule.style.opacity = 1;
      return;
    }

    // aucune proposition affichée → bonne seule centrée
    if (thematiqueMode === null && blocks.length === 0 && currentQuestion.propositions) {
      answersRow.innerHTML = "";
      answersRow.className = "dynamic-1";
      bonneSeule.textContent = currentQuestion.propositions[currentQuestion.bonneReponse];
      bonneSeule.className = "visible";
      bonneSeule.style.visibility = "visible";
      bonneSeule.style.opacity = 1;
      return;
    }

    // Cas "classique" (4 propositions visibles, pas de mode thématique)
    if (!thematiqueMode && blocks.length === 4 && currentQuestion.propositions) {
      // pos de la bonne dans l'affichage est la même que l'index de la proposition
      const goodPos = currentQuestion.bonneReponse;

      // nettoie d'abord
      blocks.forEach(b => b.classList.remove('selected','wrong','bonne'));

      if (selectedPos == null) {
        // pas de sélection → juste colorier la bonne
        if (goodPos >= 0) blocks[goodPos]?.classList.add('bonne');
      } else {
        if (selectedPos === goodPos) {
          blocks[selectedPos]?.classList.add('bonne');         // vert
        } else {
          blocks[selectedPos]?.classList.add('wrong');         // rouge
          blocks[goodPos]?.classList.add('bonne');             // vert
        }
      }
      return;
    }

    // Cas thématiques (rond/carré)
    if ((thematiqueMode === 'carre' || thematiqueMode === 'rond') && currentQuestion.propositions) {
      // trouver la position affichée de la bonne réponse
      let goodPos = -1;
      thematiqueIndexes.forEach((qi, pos) => { if (qi === currentQuestion.bonneReponse) goodPos = pos; });

      // nettoie d'abord
      blocks.forEach(b => b.classList.remove('selected','wrong','bonne'));

      if (selectedPos == null) {
        if (goodPos >= 0) blocks[goodPos]?.classList.add('bonne');
      } else {
        if (selectedPos === goodPos) {
          blocks[selectedPos]?.classList.add('bonne');
        } else {
          blocks[selectedPos]?.classList.add('wrong');
          if (goodPos >= 0) blocks[goodPos]?.classList.add('bonne');
        }
      }

      // disparition auto après 10s (comportement existant)
      clearTimeout(hideTimeout);
      hideTimeout = setTimeout(() => {
        hideQuizContainer(true);
        currentQuestion = null;
      }, 10000);
    }
  }
});
