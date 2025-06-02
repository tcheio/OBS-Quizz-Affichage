const socket = new WebSocket('ws://localhost:3000');
const quizzContainer = document.getElementById('quizz-container');
const questionBox = document.getElementById('question-box');
const answersRow = document.getElementById('answers-row');
const bonneSeule = document.getElementById('bonne-seule');
const letters = ["A", "B", "C", "D"];
let currentQuestion = null;
let thematiqueMode = null;
let thematiqueIndexes = null;
let modeFinale = false;
let hideTimeout = null;
let fadeoutTimeout = null;

function resetDisplay() {
  quizzContainer.classList.remove("visible", "fadeout");
  questionBox.textContent = "";
  questionBox.classList.remove("visible");
  answersRow.innerHTML = "";
  bonneSeule.textContent = "";
  bonneSeule.className = "";
  bonneSeule.style.visibility = "hidden";
  bonneSeule.style.opacity = 0;
  thematiqueMode = null;
  thematiqueIndexes = null;
  modeFinale = false;
}

function hideQuizContainer(smooth = true) {
  clearTimeout(fadeoutTimeout);
  if (smooth) {
    quizzContainer.classList.remove("visible");
    quizzContainer.classList.add("fadeout");
    fadeoutTimeout = setTimeout(() => {
      quizzContainer.classList.remove("fadeout");
      resetDisplay();
    }, 800); // Durée identique à la transition CSS
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
      try {
        callback(String(event.data));
      } catch (e) {
        console.error('Type de data WebSocket inattendu:', event.data);
      }
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

function renderPropositions(propositions, indexes, bonneIndex) {
  answersRow.innerHTML = "";
  answersRow.className = "dynamic-" + indexes.length;
  bonneSeule.textContent = "";
  bonneSeule.className = "";
  bonneSeule.style.visibility = "hidden";
  bonneSeule.style.opacity = 0;
  indexes.forEach((i, idx) => {
    const block = document.createElement('div');
    block.className = "answer-block";
    if (typeof bonneIndex === "number" && i === bonneIndex && thematiqueMode !== null) {
      block.classList.add('bonne');
    }
    const label = document.createElement('span');
    label.className = "answer-label";
    label.textContent = letters[idx] + ".";
    const txt = document.createElement('span');
    txt.className = "answer-text";
    txt.textContent = propositions[i];
    block.appendChild(label);
    block.appendChild(txt);
    answersRow.appendChild(block);
    setTimeout(() => { block.classList.add('visible'); }, 90 * idx + 100);
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
  catch (e) {
    questionBox.textContent = msg;
    quizzContainer.classList[msg.trim() !== "" ? "add" : "remove"]("visible");
    resetDisplay();
    return;
  }

  // --- 1. Questions finales (question + réponse unique)
  if (data.texte && data.reponse && !data.propositions) {
    currentQuestion = data;
    modeFinale = true;
    thematiqueMode = null;
    thematiqueIndexes = null;
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

  // --- 2. Affichage question avec propositions
  if (data.texte && Array.isArray(data.propositions)) {
    currentQuestion = data;
    thematiqueMode = null;
    thematiqueIndexes = null;
    questionBox.textContent = data.texte;
    quizzContainer.classList.add("visible");
    quizzContainer.classList.remove("fadeout");
    setTimeout(() => questionBox.classList.add("visible"), 70);
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

  // --- 3. Mode thématique : Rond (2 choix dont la bonne)
  if (data.action === 'showRond' && currentQuestion) {
    thematiqueMode = 'rond';
    const idxs = [currentQuestion.bonneReponse];
    const bads = shuffle([0,1,2,3].filter(i => i !== currentQuestion.bonneReponse));
    idxs.push(bads[0]);
    thematiqueIndexes = shuffle(idxs);
    renderPropositions(currentQuestion.propositions, thematiqueIndexes);
    answersRow.className = "dynamic-2";
  }
  // --- 4. Mode thématique : Carré (4 choix)
  if (data.action === 'showCarre' && currentQuestion) {
    thematiqueMode = 'carre';
    thematiqueIndexes = [0,1,2,3];
    renderPropositions(currentQuestion.propositions, thematiqueIndexes);
    answersRow.className = "dynamic-4";
  }
  // --- 5. Affichage standard des propositions (autres quizz)
  if (data.action === 'showPropositions' && currentQuestion && !thematiqueMode) {
    thematiqueIndexes = [0,1,2,3];
    renderPropositions(currentQuestion.propositions, thematiqueIndexes);
    answersRow.className = "dynamic-4";
  }
  // --- 6. Validation
  if (data.action === 'valider' && currentQuestion) {
    // 6a. Question finale : affiche la réponse seule, verte et centrée
    if (modeFinale && currentQuestion.reponse) {
      answersRow.innerHTML = "";
      answersRow.className = "dynamic-1";
      bonneSeule.textContent = currentQuestion.reponse;
      bonneSeule.className = "visible";
      bonneSeule.style.visibility = "visible";
      bonneSeule.style.opacity = 1;
    }
    // 6b. Mode thématique ou question à choix : aucune proposition affichée
    else if (thematiqueMode === null && answersRow.querySelectorAll('.answer-block.visible').length === 0 && currentQuestion.propositions) {
      answersRow.innerHTML = "";
      answersRow.className = "dynamic-1";
      bonneSeule.textContent = currentQuestion.propositions[currentQuestion.bonneReponse];
      bonneSeule.className = "visible";
      bonneSeule.style.visibility = "visible";
      bonneSeule.style.opacity = 1;
    }
    // 6c. Mode classique (propositions affichées), on colorie la bonne parmi 4
    else if (!thematiqueMode && currentQuestion.propositions) {
      const blocks = answersRow.querySelectorAll('.answer-block');
      blocks.forEach((block, idx) => {
        block.classList.toggle('bonne', idx === currentQuestion.bonneReponse);
      });
    }
    // 6d. Mode carré/rond
    else if ((thematiqueMode === 'carre' || thematiqueMode === 'rond') && currentQuestion.propositions) {
      const blocks = answersRow.querySelectorAll('.answer-block');
      thematiqueIndexes.forEach((qi, pos) => {
        blocks[pos].classList.toggle('bonne', qi === currentQuestion.bonneReponse);
      });
    }

    // --- Animation de disparition après 10s pour carré/rond (questions thematiques)
    if (thematiqueMode === 'carre' || thematiqueMode === 'rond') {
      clearTimeout(hideTimeout);
      hideTimeout = setTimeout(() => {
        hideQuizContainer(true);
        currentQuestion = null;
      }, 10000);
    }
  }
});
