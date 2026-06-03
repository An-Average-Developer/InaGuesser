// ===== STATE =====
const state = {
    currentQuestion: 0,
    score: 0,
    gameLocations: [],
    gameAnswers: [],
    gameMode: 'image',          // 'image' | 'text'
    pendingMultiplayer: false,
    textAttempts: 0,
    textCorrect: false,
    textLastAnswer: '',
    isMultiplayer: false,
    socket: null,
    playerName: '',
    roomCode: '',
    isHost: false,
    questionStartTime: 0,
    timerInterval: null,
    timeRemaining: 30,
    hasAnswered: false,
    mySelectedAnswer: '',
    mySelectedButton: null,
    currentGame: null,
    currentZone: null,
    currentLocation: null,
    gameStep: 'map',
    mapHandlerReady: false,
};

// ===== DOM CACHE =====
const el = {
    score:          document.getElementById('score'),
    current:        document.getElementById('current'),
    total:          document.getElementById('total'),
    gameBadge:      document.getElementById('game-badge'),
    locationImage:  document.getElementById('location-image'),
    instruction:    document.getElementById('instruction-text'),
    mapView:        document.getElementById('map-view'),
    optionsView:    document.getElementById('options-view'),
    zoneName:       document.getElementById('selected-zone-name'),
    optionsCont:    document.getElementById('options-container'),
    mapImg:         document.getElementById('game-map-image'),
    mapCont:        document.getElementById('game-map-container'),
    timerCont:      document.getElementById('timer-container'),
    timerBar:       document.getElementById('timer-bar'),
    timerText:      document.getElementById('timer-text'),
    scoreboard:     document.getElementById('live-scoreboard'),
    scoreList:      document.getElementById('score-list'),
    nextCont:       document.getElementById('next-question-container'),
    rcDisplay:      document.getElementById('room-code-display'),
    playerCount:    document.getElementById('player-count'),
    playersList:    document.getElementById('players-list'),
    hostControls:   document.getElementById('host-controls'),
    playerControls: document.getElementById('player-controls'),
    finalScore:     document.getElementById('final-score'),
    finalTotal:     document.getElementById('final-total'),
    pct:            document.getElementById('percentage'),
    spResults:      document.getElementById('sp-results'),
    mpResults:      document.getElementById('mp-results'),
    standings:      document.getElementById('final-standings'),
    review:         document.getElementById('answer-review'),
    resultsTitle:   document.getElementById('results-title'),
    leaveGameBtn:   document.getElementById('leave-game-btn'),
    headerStats:    document.querySelector('.header-stats'),
    // Text quiz
    textPanel:       document.getElementById('text-panel'),
    textAnswer:      document.getElementById('text-answer'),
    submitTextBtn:   document.getElementById('submit-text-btn'),
    textGuesses:     document.getElementById('text-guesses'),
    attemptDots:     document.getElementById('attempt-dots'),
    textSuggestions: document.getElementById('text-suggestions'),
};

const screens = {
    mode:     document.getElementById('mode-screen'),
    gamemode: document.getElementById('gamemode-screen'),
    lobby:    document.getElementById('lobby-screen'),
    waiting:  document.getElementById('waiting-screen'),
    game:     document.getElementById('game-screen'),
    results:  document.getElementById('results-screen'),
};

// ===== TOAST =====
function toast(msg, type = 'info', ms = 3200) {
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.textContent = msg;
    document.getElementById('toast-container').appendChild(t);
    setTimeout(() => {
        t.style.animation = 'toastOut .25s ease forwards';
        setTimeout(() => t.remove(), 260);
    }, ms);
}

// ===== SCREEN MANAGEMENT =====
const STATS_HIDDEN = new Set(['mode', 'gamemode', 'lobby']);

function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name]?.classList.add('active');
    el.headerStats.classList.toggle('hidden', STATS_HIDDEN.has(name));
}

// ===== GAME MODE SELECTION =====
function goToGameMode(isMultiplayer) {
    state.pendingMultiplayer = isMultiplayer;
    if (isMultiplayer && !state.socket) initSocket();
    showScreen('gamemode');
}

function startWithMode(mode) {
    state.gameMode = mode;
    if (state.pendingMultiplayer) {
        showScreen('lobby');
    } else {
        startSinglePlayer();
    }
}

// ===== SOCKET / MULTIPLAYER =====
function initSocket() {
    state.socket = io();

    state.socket.on('roomCreated', ({ roomCode, playerName, isHost }) => {
        state.roomCode = roomCode;
        state.playerName = playerName;
        state.isHost = isHost;
        el.rcDisplay.textContent = roomCode;
        el.hostControls.classList.remove('hidden');
        el.playerControls.classList.add('hidden');
        showScreen('waiting');
    });

    state.socket.on('roomJoined', ({ roomCode, playerName, isHost }) => {
        state.roomCode = roomCode;
        state.playerName = playerName;
        state.isHost = isHost;
        el.rcDisplay.textContent = roomCode;
        if (isHost) {
            el.hostControls.classList.remove('hidden');
            el.playerControls.classList.add('hidden');
        } else {
            el.hostControls.classList.add('hidden');
            el.playerControls.classList.remove('hidden');
        }
        showScreen('waiting');
    });

    state.socket.on('playerListUpdated', updatePlayerList);

    state.socket.on('gameStarted', ({ totalQuestions }) => {
        state.isMultiplayer = true;
        state.currentQuestion = 0;
        state.score = 0;
        el.total.textContent = totalQuestions;
        el.score.textContent = 0;
        el.scoreboard.classList.remove('hidden');
        el.nextCont.classList.add('hidden');
        el.timerCont.classList.remove('hidden');
        showScreen('game');
        if (state.gameMode === 'image') ensureMapHandler();
    });

    state.socket.on('newQuestion', ({ questionNumber, totalQuestions, image }) => {
        state.currentQuestion = questionNumber;
        el.current.textContent = questionNumber;
        el.total.textContent = totalQuestions;

        let found = null;
        outer: for (const gameName in games) {
            for (const zoneName in games[gameName].locationsByZone) {
                const loc = games[gameName].locationsByZone[zoneName].find(l => l.image === image);
                if (loc) {
                    found = {
                        location: loc,
                        zone: games[gameName].zones.find(z => z.name === zoneName),
                        game: gameName,
                    };
                    break outer;
                }
            }
        }

        if (found) {
            state.currentLocation = found.location;
            state.currentZone     = found.zone;
            state.currentGame     = found.game;
            loadQuestionUI();
        }

        startTimer();
        state.questionStartTime = Date.now();
    });

    state.socket.on('answerResult', ({ isCorrect, attemptsLeft, totalScore }) => {
        if (state.gameMode === 'text' && !isCorrect && attemptsLeft > 0) {
            // Wrong but still has tries
            addTextGuess(state.textLastAnswer, false);
            updateAttemptDots(attemptsLeft);
            setInstruction(
                `Wrong! ${attemptsLeft} ${attemptsLeft === 1 ? 'try' : 'tries'} remaining`,
                'incorrect'
            );
            el.textAnswer.value = '';
            el.textAnswer.disabled = false;
            el.submitTextBtn.disabled = false;
            el.textAnswer.focus();
        } else {
            state.score = totalScore;
            el.score.textContent = totalScore;
            state.hasAnswered = true;
            if (state.gameMode === 'text') {
                state.textCorrect = isCorrect;
                if (isCorrect) addTextGuess(state.textLastAnswer, true);
                el.textAnswer.disabled = true;
                el.submitTextBtn.disabled = true;
                updateAttemptDots(0);
            }
            setInstruction('Answer submitted! Waiting for others…', 'info');
        }
    });

    state.socket.on('scoresUpdated', updateLiveScores);

    state.socket.on('gameOver', ({ scores }) => {
        stopTimer();
        el.timerCont.classList.add('hidden');
        showMultiplayerResults(scores);
    });

    state.socket.on('timeExpired', ({ correctAnswer }) => {
        stopTimer();
        if (state.gameMode === 'text') {
            el.textAnswer.disabled = true;
            el.submitTextBtn.disabled = true;
            updateAttemptDots(0);
            if (state.textCorrect) {
                setInstruction(`Time's up! You were correct: ${correctAnswer}`, 'correct');
            } else {
                revealCorrectGuess(correctAnswer);
                setInstruction(`Time's up! The answer was: ${correctAnswer}`, 'incorrect');
            }
        } else {
            disableOptions();
            revealAnswer(correctAnswer);
            if (state.hasAnswered) {
                if (state.mySelectedAnswer === correctAnswer) {
                    setInstruction(`Time's up! You were correct: ${correctAnswer}`, 'correct');
                } else {
                    setInstruction(`Time's up! You chose "${state.mySelectedAnswer}". Correct: ${correctAnswer}`, 'incorrect');
                }
            } else {
                setInstruction(`Time's up! Correct answer: ${correctAnswer}`, 'incorrect');
            }
        }
    });

    state.socket.on('allAnswered', ({ correctAnswer }) => {
        if (state.gameMode === 'text') {
            el.textAnswer.disabled = true;
            el.submitTextBtn.disabled = true;
            setInstruction('Everyone answered!', 'info');
            completeTimerInstantly(() => {
                updateAttemptDots(0);
                if (state.textCorrect) {
                    setInstruction(`Correct! The answer was ${correctAnswer}`, 'correct');
                } else {
                    revealCorrectGuess(correctAnswer);
                    setInstruction(`The answer was: ${correctAnswer}`, 'incorrect');
                }
            });
        } else {
            setInstruction('Everyone answered!', 'info');
            completeTimerInstantly(() => {
                disableOptions();
                revealAnswer(correctAnswer);
                if (state.mySelectedAnswer === correctAnswer) {
                    setInstruction(`Correct! The answer was ${correctAnswer}`, 'correct');
                } else if (state.hasAnswered) {
                    setInstruction(`Wrong! You chose "${state.mySelectedAnswer}". Correct: ${correctAnswer}`, 'incorrect');
                } else {
                    setInstruction(`Correct answer: ${correctAnswer}`, 'incorrect');
                }
            });
        }
    });

    state.socket.on('allPlayersAnswered', () => {
        if (state.isHost) el.nextCont.classList.remove('hidden');
    });

    state.socket.on('promotedToHost', () => {
        state.isHost = true;
        el.hostControls.classList.remove('hidden');
        el.playerControls.classList.add('hidden');
        toast('You are now the host!', 'info');
    });

    state.socket.on('error', msg => toast(msg, 'error'));

    state.socket.on('disconnect', () => {
        const onLivePage = screens.game.classList.contains('active') ||
                           screens.waiting.classList.contains('active');
        if (onLivePage) toast('Disconnected from server', 'error');
    });
}

// ===== SINGLE PLAYER START =====
function startSinglePlayer() {
    state.isMultiplayer = false;
    state.currentQuestion = 0;
    state.score = 0;
    state.gameAnswers = [];

    const all = [];
    for (const gameName in games) {
        for (const zoneName in games[gameName].locationsByZone) {
            const zone = games[gameName].zones.find(z => z.name === zoneName);
            games[gameName].locationsByZone[zoneName].forEach(loc => {
                all.push({ game: gameName, zone, location: loc });
            });
        }
    }

    state.gameLocations = shuffle(all).slice(0, Math.min(10, all.length));
    el.score.textContent = 0;
    el.total.textContent = state.gameLocations.length;
    el.current.textContent = 1;
    el.scoreboard.classList.add('hidden');
    el.timerCont.classList.add('hidden');

    showScreen('game');
    loadQuestion();
    if (state.gameMode === 'image') ensureMapHandler();
}

// ===== QUESTION FLOW =====
function loadQuestion() {
    if (state.currentQuestion >= state.gameLocations.length) {
        showSinglePlayerResults();
        return;
    }
    const q = state.gameLocations[state.currentQuestion];
    state.currentGame     = q.game;
    state.currentZone     = q.zone;
    state.currentLocation = q.location;
    el.current.textContent = state.currentQuestion + 1;
    loadQuestionUI();
}

function loadQuestionUI() {
    state.hasAnswered      = false;
    state.mySelectedAnswer = '';
    state.mySelectedButton = null;
    state.textAttempts     = 0;
    state.textCorrect      = false;
    state.textLastAnswer   = '';
    state.answerRevealed   = false;

    el.gameBadge.textContent = state.currentGame;
    el.locationImage.src = state.currentLocation.image;
    applyRandomZoom(el.locationImage);
    el.nextCont.classList.add('hidden');

    if (state.gameMode === 'image') {
        state.gameStep = 'map';
        el.mapImg.src = games[state.currentGame].generalMap;
        el.mapView.classList.remove('hidden');
        el.optionsView.classList.add('hidden');
        el.textPanel.classList.add('hidden');
        setInstruction('Click on the zone in the map', '');
        el.mapCont.querySelectorAll('.zone-click-highlight').forEach(h => h.remove());
        drawZoneHighlights();
    } else {
        el.mapView.classList.add('hidden');
        el.optionsView.classList.add('hidden');
        el.textPanel.classList.remove('hidden');
        resetTextPanel();
        setInstruction('Type the name of this location', '');
    }
}

function applyRandomZoom(img) {
    const zoom = 3.5 + Math.random() * 2; // 3.5x – 5.5x
    img._zoom = zoom;

    requestAnimationFrame(() => {
        const frame = document.getElementById('image-frame');
        const w = frame.offsetWidth;
        const h = frame.offsetHeight;
        const maxTx = (zoom - 1) * w / 2;
        const maxTy = (zoom - 1) * h / 2;
        img._tx = (Math.random() * 2 - 1) * maxTx;
        img._ty = (Math.random() * 2 - 1) * maxTy;
        img.style.transform = `translate(${img._tx}px, ${img._ty}px) scale(${zoom})`;
    });
}

function initImageDrag() {
    const frame = document.getElementById('image-frame');
    const img   = el.locationImage;
    let active = false, lastX = 0, lastY = 0;

    function move(dx, dy) {
        const zoom  = img._zoom  || 1;
        const w = frame.offsetWidth;
        const h = frame.offsetHeight;
        const maxTx = (zoom - 1) * w / 2;
        const maxTy = (zoom - 1) * h / 2;
        img._tx = Math.max(-maxTx, Math.min(maxTx, (img._tx || 0) + dx));
        img._ty = Math.max(-maxTy, Math.min(maxTy, (img._ty || 0) + dy));
        img.style.transform = `translate(${img._tx}px, ${img._ty}px) scale(${zoom})`;
    }

    frame.addEventListener('mousedown', e => {
        active = true; lastX = e.clientX; lastY = e.clientY;
        frame.classList.add('dragging');
        e.preventDefault();
    });
    document.addEventListener('mousemove', e => {
        if (!active) return;
        move(e.clientX - lastX, e.clientY - lastY);
        lastX = e.clientX; lastY = e.clientY;
    });
    document.addEventListener('mouseup', () => { active = false; frame.classList.remove('dragging'); });

    frame.addEventListener('touchstart', e => {
        active = true; lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
        frame.classList.add('dragging');
        e.preventDefault();
    }, { passive: false });
    document.addEventListener('touchmove', e => {
        if (!active) return;
        move(e.touches[0].clientX - lastX, e.touches[0].clientY - lastY);
        lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
    }, { passive: true });
    document.addEventListener('touchend', () => { active = false; frame.classList.remove('dragging'); });
}

// ===== MAP CLICK HANDLER (image mode) =====
function ensureMapHandler() {
    if (state.mapHandlerReady) return;
    state.mapHandlerReady = true;

    el.mapCont.addEventListener('click', e => {
        if (state.gameStep !== 'map') return;
        if (state.isMultiplayer && state.hasAnswered) return;

        const rect = el.mapImg.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        const zone = hitZone(x, y);
        if (zone) showZoneOptions(zone);
    });
}

function hitZone(px, py) {
    for (const z of games[state.currentGame].zones) {
        const { x, y, width, height } = z.clickArea;
        if (px >= x && px <= x + width && py >= y && py <= y + height) return z;
    }
    return null;
}

function drawZoneHighlights() {
    if (!state.currentGame) return;
    el.mapCont.querySelectorAll('.zone-highlight').forEach(h => h.remove());
    for (const z of games[state.currentGame].zones) {
        const d = document.createElement('div');
        d.className = 'zone-highlight';
        d.style.cssText = `left:${z.clickArea.x}%;top:${z.clickArea.y}%;width:${z.clickArea.width}%;height:${z.clickArea.height}%`;
        d.title = z.name;
        el.mapCont.appendChild(d);
    }
}

// ===== TEXT QUIZ =====
let suggestionIndex = -1;

function getAllLocationNames() {
    if (!state.currentGame) return [];
    const names = [];
    for (const zone in games[state.currentGame].locationsByZone) {
        games[state.currentGame].locationsByZone[zone].forEach(l => names.push(l.name));
    }
    return names;
}

function showSuggestions(query) {
    const q = normalizeText(query);
    if (!q) { hideSuggestions(); return; }

    const matches = getAllLocationNames().filter(n => normalizeText(n).includes(q));
    if (!matches.length) { hideSuggestions(); return; }

    suggestionIndex = -1;
    el.textSuggestions.innerHTML = '';
    matches.slice(0, 7).forEach(name => {
        const d = document.createElement('div');
        d.className = 'suggestion-item';
        d.textContent = name;
        d.addEventListener('mousedown', e => {
            e.preventDefault();
            el.textAnswer.value = name;
            hideSuggestions();
            el.textAnswer.focus();
        });
        el.textSuggestions.appendChild(d);
    });
    el.textSuggestions.classList.remove('hidden');
}

function hideSuggestions() {
    el.textSuggestions.classList.add('hidden');
    el.textSuggestions.innerHTML = '';
    suggestionIndex = -1;
}

function navigateSuggestions(dir) {
    const items = [...el.textSuggestions.querySelectorAll('.suggestion-item')];
    if (!items.length) return false;
    suggestionIndex = Math.max(-1, Math.min(items.length - 1, suggestionIndex + dir));
    items.forEach((item, i) => item.classList.toggle('highlighted', i === suggestionIndex));
    if (suggestionIndex >= 0) el.textAnswer.value = items[suggestionIndex].textContent;
    return true;
}

function resetTextPanel() {
    el.textAnswer.value = '';
    el.textAnswer.disabled = false;
    el.submitTextBtn.disabled = false;
    el.textGuesses.innerHTML = '';
    hideSuggestions();
    updateAttemptDots(3);
    setTimeout(() => el.textAnswer.focus(), 50);
}

function updateAttemptDots(remaining) {
    el.attemptDots.querySelectorAll('.adot').forEach((dot, i) => {
        dot.classList.toggle('used', i >= remaining);
    });
}

function revealCorrectGuess(correctAnswer) {
    if (state.answerRevealed) return;
    state.answerRevealed = true;
    if (!state.hasAnswered) addTextGuess(correctAnswer, true);
}

function addTextGuess(text, isCorrect) {
    const d = document.createElement('div');
    d.className = `text-guess ${isCorrect ? 'guess-correct' : 'guess-wrong'}`;
    d.textContent = `${isCorrect ? '✅' : '❌'} ${text}`;
    el.textGuesses.appendChild(d);
}

function normalizeText(str) {
    return str.toLowerCase().trim()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '');
}

function submitTextAnswer() {
    const raw = el.textAnswer.value.trim();
    if (!raw) return;

    state.textLastAnswer = raw;
    hideSuggestions();

    if (state.isMultiplayer) {
        el.textAnswer.disabled = true;
        el.submitTextBtn.disabled = true;
        state.socket.emit('submitAnswer', {
            answer:    raw,
            timeTaken: Date.now() - state.questionStartTime,
            textMode:  true,
        });
        return;
    }

    // Single player
    state.textAttempts++;
    const remaining = 3 - state.textAttempts;
    const isCorrect = normalizeText(raw) === normalizeText(state.currentLocation.name);

    if (isCorrect) {
        addTextGuess(raw, true);
        updateAttemptDots(0);
        state.score++;
        el.score.textContent = state.score;
        setInstruction(`Correct! ${state.currentLocation.name}`, 'correct');
        el.textAnswer.disabled = true;
        el.submitTextBtn.disabled = true;
        state.gameAnswers.push(makeAnswer(raw, true));
        state.currentQuestion++;
        setTimeout(loadQuestion, 2000);

    } else if (remaining === 0) {
        addTextGuess(raw, false);
        addTextGuess(state.currentLocation.name, true);
        updateAttemptDots(0);
        setInstruction(`Out of tries! It was: ${state.currentLocation.name}`, 'incorrect');
        el.textAnswer.disabled = true;
        el.submitTextBtn.disabled = true;
        state.gameAnswers.push(makeAnswer(raw, false));
        state.currentQuestion++;
        setTimeout(loadQuestion, 2500);

    } else {
        addTextGuess(raw, false);
        updateAttemptDots(remaining);
        setInstruction(
            `Wrong! ${remaining} ${remaining === 1 ? 'try' : 'tries'} remaining`,
            'incorrect'
        );
        el.textAnswer.value = '';
        el.textAnswer.focus();
    }
}

function makeAnswer(typed, isCorrect) {
    return {
        question:         state.currentQuestion,
        game:             state.currentGame,
        correctZone:      state.currentZone.name,
        correctLocation:  state.currentLocation.name,
        selectedZone:     state.currentZone.name,
        selectedLocation: typed,
        isCorrect,
        attemptsUsed:     state.textAttempts,
    };
}

// ===== OPTIONS (image mode) =====
function showZoneOptions(zone) {
    state.gameStep = 'options';
    el.zoneName.textContent = zone.name;
    el.mapView.classList.add('hidden');
    el.optionsView.classList.remove('hidden');
    setInstruction('Select the location', '');

    const locs = games[state.currentGame].locationsByZone[zone.name];
    el.optionsCont.innerHTML = '';

    if (!locs || locs.length === 0) {
        el.optionsCont.innerHTML = '<p style="color:var(--text-muted);padding:16px">No locations in this zone.</p>';
        return;
    }

    shuffle([...locs]).forEach(loc => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';

        const imgWrap = document.createElement('div');
        imgWrap.className = 'option-btn-img-wrap';

        const img = document.createElement('img');
        img.src = loc.image;
        img.alt = loc.name;

        imgWrap.appendChild(img);

        const label = document.createElement('div');
        label.className = 'option-label';
        label.textContent = loc.name;

        btn.appendChild(imgWrap);
        btn.appendChild(label);

        btn.addEventListener('click', () => {
            if (state.isMultiplayer) {
                selectAnswerMP(loc.name, zone.name, btn);
            } else {
                selectAnswer(loc.name, zone.name);
            }
        });

        el.optionsCont.appendChild(btn);
    });
}

function selectAnswer(name, zoneName) {
    const isCorrect = name === state.currentLocation.name && zoneName === state.currentZone.name;

    state.gameAnswers.push({
        question:         state.currentQuestion,
        game:             state.currentGame,
        correctZone:      state.currentZone.name,
        correctLocation:  state.currentLocation.name,
        selectedZone:     zoneName,
        selectedLocation: name,
        isCorrect,
    });

    if (isCorrect) {
        state.score++;
        el.score.textContent = state.score;
    }

    disableOptions();
    revealAnswer(state.currentLocation.name, name);
    setInstruction(
        isCorrect
            ? `Correct! ${state.currentLocation.name}`
            : `Wrong! Correct: ${state.currentLocation.name} (${state.currentZone.name})`,
        isCorrect ? 'correct' : 'incorrect'
    );

    state.currentQuestion++;
    setTimeout(loadQuestion, 2500);
}

function selectAnswerMP(name, zoneName, btn) {
    if (state.hasAnswered) return;
    state.hasAnswered       = true;
    state.mySelectedAnswer  = name;
    state.mySelectedButton  = btn;

    disableOptions();
    btn.classList.add('selected');

    state.socket.emit('submitAnswer', {
        answer:    name,
        timeTaken: Date.now() - state.questionStartTime,
    });
}

function disableOptions() {
    el.optionsCont.querySelectorAll('.option-btn').forEach(b => { b.disabled = true; });
}

function revealAnswer(correct, selected = null) {
    el.optionsCont.querySelectorAll('.option-btn').forEach(btn => {
        const lbl = btn.querySelector('.option-label');
        if (!lbl) return;
        const text = lbl.textContent;
        if (text === correct) {
            btn.classList.remove('selected', 'incorrect');
            btn.classList.add('correct');
        } else if (selected && text === selected && selected !== correct) {
            btn.classList.remove('selected');
            btn.classList.add('incorrect');
        }
    });
}

function goBackToMap() {
    if (state.isMultiplayer && state.hasAnswered) return;
    state.gameStep = 'map';
    el.mapView.classList.remove('hidden');
    el.optionsView.classList.add('hidden');
    setInstruction('Click on the zone in the map', '');
}

// ===== INSTRUCTION =====
function setInstruction(text, type) {
    el.instruction.textContent = text;
    el.instruction.className = 'instruction';
    if (type) el.instruction.classList.add(type);
}

// ===== TIMER =====
function startTimer() {
    stopTimer();
    state.timeRemaining = 30;
    el.timerText.textContent = 30;
    el.timerBar.style.width = '100%';
    el.timerBar.className = 'timer-fill';

    state.timerInterval = setInterval(() => {
        state.timeRemaining--;
        el.timerText.textContent = state.timeRemaining;
        el.timerBar.style.width = (state.timeRemaining / 30 * 100) + '%';
        if (state.timeRemaining <= 5)       el.timerBar.className = 'timer-fill danger';
        else if (state.timeRemaining <= 10) el.timerBar.className = 'timer-fill warning';
        if (state.timeRemaining <= 0) stopTimer();
    }, 1000);
}

function stopTimer() {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
}

function completeTimerInstantly(cb) {
    stopTimer();
    const start = state.timeRemaining;
    const duration = 800;
    const began = Date.now();
    el.timerBar.className = 'timer-fill danger';

    const anim = setInterval(() => {
        const p = Math.min((Date.now() - began) / duration, 1);
        const rem = Math.floor(start * (1 - p));
        el.timerText.textContent = rem;
        el.timerBar.style.width = (rem / 30 * 100) + '%';
        if (p >= 1) {
            clearInterval(anim);
            el.timerText.textContent = 0;
            el.timerBar.style.width = '0%';
            cb?.();
        }
    }, 16);
}

// ===== MULTIPLAYER UI =====
function updatePlayerList(players) {
    el.playerCount.textContent = players.length;
    el.playersList.innerHTML = '';
    players.forEach(p => {
        const div = document.createElement('div');
        div.className = 'player-item' + (p.ready ? ' ready' : '');
        div.innerHTML = `<span>${p.name}</span><span class="player-status">${p.ready ? '✓ Ready' : ''}</span>`;
        el.playersList.appendChild(div);
    });
}

function updateLiveScores(scores) {
    scores.sort((a, b) => b.score - a.score);
    el.scoreList.innerHTML = '';
    scores.forEach((p, i) => {
        const div = document.createElement('div');
        div.className = 'score-item' + (p.name === state.playerName ? ' me' : '');
        div.innerHTML = `<span class="pname">${i + 1}. ${p.name}</span><span class="pscore">${p.score}</span>`;
        el.scoreList.appendChild(div);
    });
}

function showMultiplayerResults(scores) {
    el.resultsTitle.textContent = 'Final Results!';
    el.spResults.classList.add('hidden');
    el.mpResults.classList.remove('hidden');
    el.review.innerHTML = '';

    const me = scores.find(s => s.name === state.playerName);
    if (me) el.finalScore.textContent = me.score;

    el.standings.innerHTML = '';
    const medals = ['🥇', '🥈', '🥉'];
    scores.forEach((p, i) => {
        const div = document.createElement('div');
        div.className = 'standing-item' + (p.name === state.playerName ? ' mine' : '');
        div.innerHTML = `
            <span class="s-rank">${medals[i] ?? (i + 1) + '.'}</span>
            <span class="s-name">${p.name}</span>
            <span class="s-score">${p.score}</span>
        `;
        el.standings.appendChild(div);
    });

    showScreen('results');
}

// ===== SINGLE PLAYER RESULTS =====
function showSinglePlayerResults() {
    el.resultsTitle.textContent = 'Game Over!';
    el.spResults.classList.remove('hidden');
    el.mpResults.classList.add('hidden');
    el.finalScore.textContent = state.score;
    el.finalTotal.textContent = state.gameLocations.length;
    el.pct.textContent = Math.round(state.score / state.gameLocations.length * 100) + '%';
    renderReview();
    showScreen('results');
}

function renderReview() {
    el.review.innerHTML = '';
    if (state.gameAnswers.length === 0) return;

    const h = document.createElement('h3');
    h.className = 'review-title';
    h.textContent = 'Answer Review';
    el.review.appendChild(h);

    state.gameAnswers.forEach((a, i) => {
        const div = document.createElement('div');
        div.className = `review-item ${a.isCorrect ? 'ok' : 'bad'}`;
        const triesNote = a.attemptsUsed != null
            ? ` — ${a.attemptsUsed} ${a.attemptsUsed === 1 ? 'try' : 'tries'}`
            : '';
        div.innerHTML = `
            <div class="review-head">
                <span class="review-qn">Question ${i + 1}${triesNote}</span>
                <span>${a.isCorrect ? '✅' : '❌'}</span>
            </div>
            <span class="review-badge">${a.game}</span>
            <p class="review-line"><strong>Correct:</strong> ${a.correctLocation} (${a.correctZone})</p>
            <p class="review-line ${a.isCorrect ? 'good-answer' : 'bad-answer'}">
                <strong>You answered:</strong> ${a.selectedLocation}
            </p>
        `;
        el.review.appendChild(div);
    });
}

// ===== UTILITY =====
function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// ===== EVENT LISTENERS =====
initImageDrag();

document.getElementById('singleplayer-btn').addEventListener('click', () => goToGameMode(false));
document.getElementById('multiplayer-btn').addEventListener('click', () => goToGameMode(true));

document.getElementById('back-from-gamemode-btn').addEventListener('click', () => showScreen('mode'));
document.getElementById('mode-image-btn').addEventListener('click', () => startWithMode('image'));
document.getElementById('mode-text-btn').addEventListener('click', () => startWithMode('text'));

document.getElementById('back-to-mode-btn').addEventListener('click', () => showScreen('gamemode'));

document.getElementById('create-room-btn').addEventListener('click', () => {
    const name = document.getElementById('create-name').value.trim();
    if (!name) { toast('Please enter your name', 'error'); return; }
    state.socket.emit('createRoom', name);
});

document.getElementById('join-room-btn').addEventListener('click', () => {
    const name = document.getElementById('join-name').value.trim();
    const code = document.getElementById('room-code').value.trim().toUpperCase();
    if (!name) { toast('Please enter your name', 'error'); return; }
    if (!code) { toast('Please enter a room code', 'error'); return; }
    state.socket.emit('joinRoom', { roomCode: code, playerName: name });
});

document.getElementById('ready-btn').addEventListener('click', function () {
    state.socket.emit('playerReady');
    this.disabled = true;
    this.textContent = '✓ Ready!';
    this.classList.add('ready-done');
});

document.getElementById('start-game-btn').addEventListener('click', () => {
    if (locations.length === 0) { toast('No locations configured', 'error'); return; }
    const data = shuffle([...locations]).map(l => ({ name: l.name, image: l.image }));
    state.socket.emit('startGame', data);
});

document.getElementById('leave-room-btn').addEventListener('click', () => {
    state.socket?.disconnect();
    state.socket = null;
    state.isMultiplayer = false;
    showScreen('mode');
});

document.getElementById('next-question-btn').addEventListener('click', () => {
    el.nextCont.classList.add('hidden');
    state.socket.emit('nextQuestion');
});

document.getElementById('back-to-map-btn').addEventListener('click', goBackToMap);

document.getElementById('leave-game-btn').addEventListener('click', () => {
    stopTimer();
    if (state.isMultiplayer) {
        state.socket?.disconnect();
        state.socket = null;
    }
    state.isMultiplayer = false;
    showScreen('mode');
});

document.getElementById('submit-text-btn').addEventListener('click', submitTextAnswer);

document.getElementById('text-answer').addEventListener('input', e => {
    showSuggestions(e.target.value);
});

document.getElementById('text-answer').addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); navigateSuggestions(1);  return; }
    if (e.key === 'ArrowUp')   { e.preventDefault(); navigateSuggestions(-1); return; }
    if (e.key === 'Escape')    { hideSuggestions(); return; }
    if (e.key === 'Enter') {
        if (!el.textSuggestions.classList.contains('hidden') && suggestionIndex >= 0) {
            hideSuggestions();
        } else {
            submitTextAnswer();
        }
    }
});

document.getElementById('text-answer').addEventListener('blur', () => {
    setTimeout(hideSuggestions, 150);
});

document.getElementById('restart-btn').addEventListener('click', () => {
    if (state.isMultiplayer) {
        const rb = document.getElementById('ready-btn');
        rb.disabled = false;
        rb.textContent = 'Ready Up';
        rb.classList.remove('ready-done');
        showScreen('waiting');
    } else {
        startSinglePlayer();
    }
});
