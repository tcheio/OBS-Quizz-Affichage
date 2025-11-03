const socket = new WebSocket('ws://localhost:3000');
const quizzContainer = document.getElementById('quizz-container');
const questionBox = document.getElementById('question-box');
const answersRow = document.getElementById('answers-row');
const bonneSeule = document.getElementById('bonne-seule');
const letters = ["A", "B", "C", "D"];

let currentQuestion = null;
let thematiqueMode = null;      // null | 'rond' | 'carre'
let thematiqueIndexes = null;   // mapping indices source -> positions affichées (rond/carré)
let modeFinale = false;
let hideTimeout = null;
let fadeoutTimeout = null;

// Position sélectionnée à l'écran (0..3 ou 0..1 pour rond)
let selectedPos = null;

/* ====== SFX ====== */
// ⚠️ Chemins relatifs à obs.html
const sfx = {
  select: new Audio('../sounds/select.mp3'),
  success: new Audio('../sounds/success.mp3'),
  error: new Audio('../sounds/error.mp3'),
};
Object.values(sfx).forEach(a => {
  a.preload = 'auto';
  a.volume = 1.0;
});

// Gestion déblocage autoplay
let audioUnlocked = false;
let audioUnlockUI = null;

function createAudioUnlockUI() {
  if (audioUnlockUI) return audioUnlockUI;
  const btn = document.createElement('button');
  btn.textContent = 'Activer le son';
  btn.style.position = 'fixed';
  btn.style.zIndex = '99999';
  btn.style.left = '50%';
  btn.style.top = '20px';
  btn.style.transform = 'translateX(-50%)';
  btn.style.padding = '10px 16px';
  btn.style.border = '2px solid #b1f';
  btn.style.borderRadius = '10px';
  btn.style.background = '#180036cc';
  btn.style.color = '#fff';
  btn.style.fontSize = '16px';
  btn.style.cursor = 'pointer';
  btn.style.boxShadow = '0 4px 16px #0008';
  btn.onclick = async () => {
    try {
      sfx.select.currentTime = 0;
      await sfx.select.play();
      audioUnlocked = true;
      btn.remove();
      audioUnlockUI = null;
    } catch (e) {
      console.warn('Audio toujours bloqué:', e);
    }
  };
  document.body.appendChild(btn);
  audioUnlockUI = btn;
  return btn;
}

function ensureBonneSeuleInDom() {
  if (bonneSeule.parentNode !== answersRow) {
    answersRow.appendChild(bonneSeule);
  }
}

async function playSfx(name) {
  const a = sfx[name];
  if (!a) return;
  try {
    a.currentTime = 0;
    const p = a.play();
    if (p && typeof p.then === 'function') {
      await p;
    }
    audioUnlocked = true;
  } catch (e) {
    if (!audioUnlocked) {
      createAudioUnlockUI();
    }
    console.warn(`Lecture audio "${name}" bloquée:`, e && e.name, e && e.message);
  }
}

/* ====== THEME ====== */
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
  answersRow.className = "dynamic-1";
  ensureBonneSeuleInDom();
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

/* === Chronos Overlay === */
const chronoLeftEl = document.getElementById('chrono-left');
const chronoRightEl = document.getElementById('chrono-right');

function formatTime(t) {
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
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
    b.classList.remove('selected', 'wrong', 'bonne');
  });
}

function markSelected(pos) {
  const blocks = answersRow.querySelectorAll('.answer-block.visible');
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

  // Masquage explicite vide
  if (!msg || msg.trim() === "") {
    hideQuizContainer(true);
    currentQuestion = null;
    return;
  }

  let data;
  try {
    data = JSON.parse(msg);

    // === Toggle affichage des chronos ===
    if (data && data.action === 'chronoToggleDisplay') {
      const visible = !!data.visible;
      document.getElementById('chrono-left')?.style.setProperty('display', visible ? 'block' : 'none');
      document.getElementById('chrono-right')?.style.setProperty('display', visible ? 'block' : 'none');
      return;
    }

      // === Chronos overlay (gauche/droite) ===
  if (data && data.action === 'chronoUpdate') {
  const targetId = data.side === 'left' ? 'chrono-left' : 'chrono-right';
  const el = document.getElementById(targetId);
  if (el) {
    const t = Math.max(0, Number(data.time) || 0);
    const m = String(Math.floor(t / 60)).padStart(2, '0');
    const s = String(t % 60).padStart(2, '0');
    el.textContent = `${m}:${s}`;
    el.style.opacity = data.running ? '1' : '0.6';
    el.classList.toggle('chrono-timeout', t === 0);
  }
  return;
}


  } catch {
    // message texte brut : on l'affiche proprement (sans resetDisplay qui efface)
    currentQuestion = null;
    modeFinale = false;
    thematiqueMode = null;
    thematiqueIndexes = null;
    selectedPos = null;

    questionBox.textContent = msg;
    quizzContainer.classList.add("visible");
    quizzContainer.classList.remove("fadeout");
    setTimeout(() => questionBox.classList.add("visible"), 70);

    answersRow.innerHTML = "";
    answersRow.className = "";
    bonneSeule.textContent = "";
    bonneSeule.className = "";
    bonneSeule.style.visibility = "hidden";
    bonneSeule.style.opacity = 0;
    return;
  }

  /* 0) Changement de thème */
  if (data.action === 'setTheme') {
    applyTheme(data.theme);
    return;
  }

  /* 0.b) Contexte de mode (ex: admin envoie {action:'mode', kind:'hidden'}) */
  if (data.action === 'mode') {
    // 'hidden' -> on garde la question visible, mais aucune proposition affichée
    if (data.kind === 'hidden') {
      thematiqueMode = null;
      thematiqueIndexes = null;
      selectedPos = null;

      // Nettoie les propositions à l'écran (si jamais il y en avait)
      answersRow.innerHTML = "";
      answersRow.className = "";
      bonneSeule.textContent = "";
      bonneSeule.className = "";
      bonneSeule.style.visibility = "hidden";
      bonneSeule.style.opacity = 0;
    }
    return;
  }

  /* 1) Sélection (A/B/C/D) */
  if (data.action === 'select' && typeof data.pos === 'number') {
    const blocks = answersRow.querySelectorAll('.answer-block.visible');
    if (blocks.length > 0) {
      const pos = Math.max(0, Math.min(data.pos|0, blocks.length - 1));
      markSelected(pos);
      playSfx('select');
    }
    return;
  }

  /* 2) Question finale (texte + réponse unique) */
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

  /* 3) Nouvelle question à choix */
  if (data.texte && Array.isArray(data.propositions)) {
    currentQuestion = data;
    thematiqueMode = null;
    thematiqueIndexes = null;
    selectedPos = null;

    questionBox.textContent = data.texte;
    quizzContainer.classList.add("visible");
    quizzContainer.classList.remove("fadeout");
    setTimeout(() => questionBox.classList.add("visible"), 70);

    // Prépare 4 blocs (non visibles tant qu'on n'a pas reçu un show*)
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

  /* 4) Modes thématiques */
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

  /* 5) Affichage standard des propositions (hors thématique) */
  if (data.action === 'showPropositions' && currentQuestion && !thematiqueMode) {
    thematiqueIndexes = [0,1,2,3]; // ordre A/B/C/D
    renderPropositions(currentQuestion.propositions, thematiqueIndexes);
    answersRow.className = "dynamic-4";
  }

/* 6) Validation — accepte 'valider' (FR) et 'validate' (EN) */
if ((data.action === 'valider' || data.action === 'validate') && currentQuestion) {
  const visibleBlocks = answersRow.querySelectorAll('.answer-block.visible');

  // 6a. Question finale → réponse seule
  if (modeFinale && currentQuestion.reponse) {
    answersRow.innerHTML = "";
    answersRow.className = "dynamic-1";
    ensureBonneSeuleInDom();
    bonneSeule.textContent = currentQuestion.reponse;
    bonneSeule.className = "visible";
    bonneSeule.style.visibility = "visible";
    bonneSeule.style.opacity = 1;
    return;
  }

  // 6b. Aucune proposition affichée → afficher la bonne seule, centrée
  if (visibleBlocks.length === 0 && currentQuestion.propositions) {
    answersRow.innerHTML = "";
    answersRow.className = "dynamic-1";
    ensureBonneSeuleInDom();
    bonneSeule.textContent = currentQuestion.propositions[currentQuestion.bonneReponse];
    bonneSeule.className = "visible";
    bonneSeule.style.visibility = "visible";
    bonneSeule.style.opacity = 1;
    return;
  }

  // 6c. Mode classique (4 propositions visibles, pas de thématique)
  if (!thematiqueMode && visibleBlocks.length === 4 && currentQuestion.propositions) {
    const goodPos = currentQuestion.bonneReponse;

    // nettoie d'abord
    visibleBlocks.forEach(b => b.classList.remove('selected','wrong','bonne'));

    if (selectedPos == null) {
      if (goodPos >= 0) visibleBlocks[goodPos]?.classList.add('bonne');
    } else {
      if (selectedPos === goodPos) {
        visibleBlocks[selectedPos]?.classList.add('bonne'); // vert
        playSfx('success'); // sons conservés
      } else {
        visibleBlocks[selectedPos]?.classList.add('wrong'); // rouge
        visibleBlocks[goodPos]?.classList.add('bonne');     // vert
        playSfx('error');   // sons conservés
      }
    }
    return;
  }

  // 6d. Modes thématiques (rond/carré)
  if ((thematiqueMode === 'carre' || thematiqueMode === 'rond') && currentQuestion.propositions) {
    // position affichée de la bonne
    let goodPos = -1;
    thematiqueIndexes.forEach((qi, pos) => { if (qi === currentQuestion.bonneReponse) goodPos = pos; });

    // nettoie d'abord
    visibleBlocks.forEach(b => b.classList.remove('selected','wrong','bonne'));

    if (selectedPos == null) {
      if (goodPos >= 0) visibleBlocks[goodPos]?.classList.add('bonne');
    } else {
      if (selectedPos === goodPos) {
        visibleBlocks[selectedPos]?.classList.add('bonne');
        playSfx('success'); // sons conservés
      } else {
        visibleBlocks[selectedPos]?.classList.add('wrong');
        if (goodPos >= 0) visibleBlocks[goodPos]?.classList.add('bonne');
        playSfx('error');   // sons conservés
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
