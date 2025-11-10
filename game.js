// Game state
let currentQuestion = 0;
let score = 0;
let gameLocations = [];
let gameAnswers = []; // Store user answers for end-of-round review
let usedLocations = [];
let isMultiplayer = false;
let socket = null;
let playerName = '';
let roomCode = '';
let isHost = false;
let questionStartTime = 0;
let timerInterval = null;
let timeRemaining = 30;
let currentCorrectAnswer = '';
let hasAnswered = false;
let mySelectedAnswer = '';
let mySelectedButton = null;
let selectedZone = null;
let currentZone = null;
let currentLocation = null;
let currentGame = null;
let gameStep = 'map'; // 'map' or 'options'

// DOM elements - Screens
const modeScreen = document.getElementById('mode-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const waitingScreen = document.getElementById('waiting-screen');
const startScreen = document.getElementById('start-screen');
const zoneScreen = document.getElementById('zone-screen');
const gameScreen = document.getElementById('game-screen');
const resultsScreen = document.getElementById('results-screen');

// DOM elements - Buttons
const singleplayerBtn = document.getElementById('singleplayer-btn');
const multiplayerBtn = document.getElementById('multiplayer-btn');
const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomBtn = document.getElementById('join-room-btn');
const backToModeBtn = document.getElementById('back-to-mode-btn');
const backBtn = document.getElementById('back-btn');
const startBtn = document.getElementById('start-btn');
const startGameBtn = document.getElementById('start-game-btn');
const readyBtn = document.getElementById('ready-btn');
const leaveRoomBtn = document.getElementById('leave-room-btn');
const restartBtn = document.getElementById('restart-btn');

// DOM elements - Inputs
const createNameInput = document.getElementById('create-name');
const joinNameInput = document.getElementById('join-name');
const roomCodeInput = document.getElementById('room-code');

// DOM elements - Game
const gameBadge = document.getElementById('game-badge');
const instructionText = document.getElementById('instruction-text');
const locationImage = document.getElementById('location-image');
const mapView = document.getElementById('map-view');
const optionsView = document.getElementById('options-view');
const selectedZoneNameEl = document.getElementById('selected-zone-name');
const optionsContainer = document.getElementById('options-container');
const gameMapImage = document.getElementById('game-map-image');
const gameMapContainer = document.getElementById('game-map-container');
const backToMapBtn = document.getElementById('back-to-map-btn');
const feedbackElement = document.getElementById('feedback');
const scoreElement = document.getElementById('score');
const currentElement = document.getElementById('current');
const totalElement = document.getElementById('total');
const finalScoreElement = document.getElementById('final-score');
const finalTotalElement = document.getElementById('final-total');
const percentageElement = document.getElementById('percentage');

// DOM elements - Multiplayer
const roomCodeDisplay = document.getElementById('room-code-display');
const playerCount = document.getElementById('player-count');
const playersList = document.getElementById('players-list');
const hostControls = document.getElementById('host-controls');
const playerControls = document.getElementById('player-controls');
const liveScoreboard = document.getElementById('live-scoreboard');
const scoreList = document.getElementById('score-list');
const multiplayerResults = document.getElementById('multiplayer-results');
const finalStandings = document.getElementById('final-standings');
const nextQuestionContainer = document.getElementById('next-question-container');
const nextQuestionBtn = document.getElementById('next-question-btn');
const timerContainer = document.getElementById('timer-container');
const timerBar = document.getElementById('timer-bar');
const timerText = document.getElementById('timer-text');

// ===========================================
// SOCKET.IO CONNECTION (MULTIPLAYER)
// ===========================================
function initSocket() {
    socket = io();

    socket.on('roomCreated', ({ roomCode: code, playerName: name, isHost: host }) => {
        roomCode = code;
        playerName = name;
        isHost = host;
        roomCodeDisplay.textContent = roomCode;
        showScreen('waiting');
        if (isHost) {
            hostControls.style.display = 'block';
            playerControls.style.display = 'none';
        }
    });

    socket.on('roomJoined', ({ roomCode: code, playerName: name, isHost: host }) => {
        roomCode = code;
        playerName = name;
        isHost = host;
        roomCodeDisplay.textContent = roomCode;
        showScreen('waiting');
        if (isHost) {
            hostControls.style.display = 'block';
            playerControls.style.display = 'none';
        } else {
            hostControls.style.display = 'none';
            playerControls.style.display = 'block';
        }
    });

    socket.on('playerListUpdated', (players) => {
        updatePlayerList(players);
    });

    socket.on('gameStarted', ({ totalQuestions }) => {
        currentQuestion = 0;
        score = 0;
        totalElement.textContent = totalQuestions;
        scoreElement.textContent = 0;
        liveScoreboard.style.display = 'block';
        nextQuestionContainer.style.display = 'none';
        timerContainer.style.display = 'block';
        hasAnswered = false;
        mySelectedAnswer = '';
        mySelectedButton = null;
        showScreen('game');
        initGameMapClickHandler();
    });

    socket.on('newQuestion', ({ questionNumber, totalQuestions, image, correctAnswer }) => {
        currentQuestion = questionNumber;
        currentElement.textContent = questionNumber;
        totalElement.textContent = totalQuestions;
        currentCorrectAnswer = correctAnswer;

        // Find the location, zone, and game from the image
        let foundLocation = null;
        let foundZone = null;
        let foundGame = null;

        for (let gameName in games) {
            const gameData = games[gameName];
            for (let zoneName in gameData.locationsByZone) {
                const location = gameData.locationsByZone[zoneName].find(loc => loc.image === image);
                if (location) {
                    foundLocation = location;
                    foundZone = gameData.zones.find(z => z.name === zoneName);
                    foundGame = gameName;
                    break;
                }
            }
            if (foundLocation) break;
        }

        if (foundLocation && foundZone && foundGame) {
            currentLocation = foundLocation;
            currentZone = foundZone;
            currentGame = foundGame;
            loadMultiplayerQuestion();
        }

        // Start timer
        startTimer();
        questionStartTime = Date.now();
    });

    socket.on('answerResult', ({ isCorrect, correctAnswer, points, totalScore }) => {
        // Update score silently (feedback will be shown when timer completes)
        score = totalScore;
        scoreElement.textContent = score;

        // Show a subtle "Answer submitted!" message
        instructionText.textContent = 'Answer submitted! Waiting for other players...';
    });

    socket.on('scoresUpdated', (scores) => {
        updateLiveScores(scores);
    });

    socket.on('gameOver', ({ scores }) => {
        stopTimer();
        timerContainer.style.display = 'none';
        showMultiplayerResults(scores);
    });

    socket.on('timeExpired', ({ correctAnswer }) => {
        // Time ran out - disable all buttons and show correct answer
        stopTimer();
        disableAllOptions();
        showCorrectAnswerMultiplayer(correctAnswer);

        // Show personalized feedback based on whether player answered
        if (hasAnswered) {
            if (mySelectedAnswer === correctAnswer) {
                instructionText.textContent = `Time's up! You were correct: ${correctAnswer}`;
                instructionText.style.color = '#4CAF50';
            } else {
                instructionText.textContent = `Time's up! You selected "${mySelectedAnswer}". Correct answer: ${correctAnswer}`;
                instructionText.style.color = '#dc3545';
            }
        } else {
            instructionText.textContent = `Time's up! You didn't answer. Correct answer: ${correctAnswer}`;
            instructionText.style.color = '#dc3545';
        }
    });

    socket.on('allAnswered', ({ correctAnswer }) => {
        // Everyone answered - show message and complete timer quickly
        instructionText.textContent = 'Everyone answered!';
        instructionText.style.color = '#667eea';

        completeTimerInstantly(() => {
            disableAllOptions();
            showCorrectAnswerMultiplayer(correctAnswer);

            // Show personalized feedback
            if (mySelectedAnswer === correctAnswer) {
                instructionText.textContent = `Correct! The answer was ${correctAnswer}`;
                instructionText.style.color = '#4CAF50';
            } else if (hasAnswered) {
                instructionText.textContent = `Wrong! You selected "${mySelectedAnswer}". Correct answer: ${correctAnswer}`;
                instructionText.style.color = '#dc3545';
            } else {
                instructionText.textContent = `Time's up! Correct answer: ${correctAnswer}`;
                instructionText.style.color = '#dc3545';
            }
        });
    });

    socket.on('allPlayersAnswered', () => {
        // Show next question button (only host receives this)
        if (isHost) {
            nextQuestionContainer.style.display = 'block';
        }
    });

    socket.on('error', (message) => {
        alert(message);
    });

    socket.on('promotedToHost', () => {
        isHost = true;
        hostControls.style.display = 'block';
        playerControls.style.display = 'none';
        alert('You are now the host!');
    });
}

// ===========================================
// SCREEN MANAGEMENT
// ===========================================
function showScreen(screenName) {
    modeScreen.classList.remove('active');
    lobbyScreen.classList.remove('active');
    waitingScreen.classList.remove('active');
    startScreen.classList.remove('active');
    zoneScreen.classList.remove('active');
    gameScreen.classList.remove('active');
    resultsScreen.classList.remove('active');

    if (screenName === 'mode') modeScreen.classList.add('active');
    else if (screenName === 'lobby') lobbyScreen.classList.add('active');
    else if (screenName === 'waiting') waitingScreen.classList.add('active');
    else if (screenName === 'start') startScreen.classList.add('active');
    else if (screenName === 'zone') zoneScreen.classList.add('active');
    else if (screenName === 'game') gameScreen.classList.add('active');
    else if (screenName === 'results') resultsScreen.classList.add('active');
}

// ===========================================
// ZONE SELECTION FUNCTIONS
// ===========================================
function initZoneSelection() {
    const generalMap = document.getElementById('general-map');
    const mapContainer = document.querySelector('.map-container');

    // Use first game's map by default
    const firstGameName = Object.keys(games)[0];
    generalMap.src = games[firstGameName].generalMap;

    // Add click handler to map
    generalMap.addEventListener('click', function(event) {
        const rect = generalMap.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 100;
        const y = ((event.clientY - rect.top) / rect.height) * 100;

        // Find which zone was clicked (using first game's zones)
        const clickedZone = detectZone(x, y);

        if (clickedZone) {
            selectZone(clickedZone);
        } else {
            alert('Please click on a zone in the map!');
        }
    });

    // Draw zone overlays (optional visual guide)
    drawZoneOverlays();
}

function detectZone(clickX, clickY) {
    // Use first game's zones for zone selection screen
    const firstGameName = Object.keys(games)[0];
    const gameZones = games[firstGameName].zones;

    for (let zone of gameZones) {
        const { x, y, width, height } = zone.clickArea;

        if (clickX >= x && clickX <= (x + width) &&
            clickY >= y && clickY <= (y + height)) {
            return zone;
        }
    }
    return null;
}

function drawZoneOverlays() {
    const generalMap = document.getElementById('general-map');
    const mapContainer = document.querySelector('.map-container');

    // Remove existing overlays
    const existingOverlays = mapContainer.querySelectorAll('.zone-highlight');
    existingOverlays.forEach(overlay => overlay.remove());

    // Use first game's zones
    const firstGameName = Object.keys(games)[0];
    const gameZones = games[firstGameName].zones;

    // Create overlays for each zone
    gameZones.forEach(zone => {
        const overlay = document.createElement('div');
        overlay.className = 'zone-highlight';
        overlay.style.left = zone.clickArea.x + '%';
        overlay.style.top = zone.clickArea.y + '%';
        overlay.style.width = zone.clickArea.width + '%';
        overlay.style.height = zone.clickArea.height + '%';

        // Add zone name tooltip
        overlay.title = zone.name;

        mapContainer.appendChild(overlay);
    });
}

function selectZone(zone) {
    selectedZone = zone.name;
    // Start game with all locations from all games
    initGameWithZone(selectedZone);
}

// ===========================================
// MULTIPLAYER FUNCTIONS
// ===========================================
function startTimer() {
    timeRemaining = 30;
    timerContainer.style.display = 'block';
    timerText.textContent = timeRemaining;
    timerBar.style.width = '100%';
    timerBar.className = 'timer-bar';

    if (timerInterval) {
        clearInterval(timerInterval);
    }

    timerInterval = setInterval(() => {
        timeRemaining--;
        timerText.textContent = timeRemaining;

        // Update timer bar width
        const percentage = (timeRemaining / 30) * 100;
        timerBar.style.width = percentage + '%';

        // Change color based on time remaining
        if (timeRemaining <= 5) {
            timerBar.className = 'timer-bar danger';
        } else if (timeRemaining <= 10) {
            timerBar.className = 'timer-bar warning';
        }

        if (timeRemaining <= 0) {
            stopTimer();
        }
    }, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function completeTimerInstantly(callback) {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    // Animate timer completing quickly
    const startTime = timeRemaining;
    const duration = 1000; // 1 second animation
    const startTimestamp = Date.now();

    timerBar.className = 'timer-bar danger';

    const animateTimer = setInterval(() => {
        const elapsed = Date.now() - startTimestamp;
        const progress = Math.min(elapsed / duration, 1);

        timeRemaining = Math.floor(startTime * (1 - progress));
        timerText.textContent = timeRemaining;

        const percentage = (timeRemaining / 30) * 100;
        timerBar.style.width = percentage + '%';

        if (progress >= 1) {
            clearInterval(animateTimer);
            timeRemaining = 0;
            timerText.textContent = 0;
            timerBar.style.width = '0%';
            if (callback) callback();
        }
    }, 16); // ~60fps
}

function disableAllOptions() {
    const allButtons = optionsContainer.querySelectorAll('.option-btn');
    allButtons.forEach(btn => btn.disabled = true);
}

function showCorrectAnswerMultiplayer(correctAnswer) {
    const allButtons = optionsContainer.querySelectorAll('.option-btn');
    allButtons.forEach(btn => {
        // Reset styling
        btn.style.opacity = '1';
        btn.style.border = '3px solid #dee2e6';

        const btnLabel = btn.querySelector('.option-label');

        // Highlight correct answer in green
        if (btnLabel && btnLabel.textContent === correctAnswer) {
            btn.classList.add('correct');
        }

        // Highlight player's selected answer
        if (mySelectedButton && btn === mySelectedButton) {
            if (mySelectedAnswer === correctAnswer) {
                // Player was correct - already green
                btn.classList.add('correct');
            } else {
                // Player was wrong - show in red
                btn.classList.add('incorrect');
            }
        }
    });
}

function updatePlayerList(players) {
    playersList.innerHTML = '';
    playerCount.textContent = players.length;

    players.forEach(player => {
        const playerDiv = document.createElement('div');
        playerDiv.className = 'player-item';
        playerDiv.textContent = player.name;
        if (player.ready) {
            playerDiv.textContent += ' ✓';
            playerDiv.style.color = '#4CAF50';
        }
        playersList.appendChild(playerDiv);
    });
}

function updateLiveScores(scores) {
    scoreList.innerHTML = '';
    scores.sort((a, b) => b.score - a.score);

    scores.forEach((player, index) => {
        const scoreDiv = document.createElement('div');
        scoreDiv.className = 'score-item';
        scoreDiv.textContent = `${index + 1}. ${player.name}: ${player.score}`;
        scoreList.appendChild(scoreDiv);
    });
}

function showMultiplayerResults(scores) {
    finalStandings.innerHTML = '';
    multiplayerResults.style.display = 'block';

    // Find current player's score
    const myScore = scores.find(s => s.name === playerName);
    if (myScore) {
        finalScoreElement.textContent = myScore.score;
    }

    // Hide single-player percentage (not relevant in multiplayer)
    percentageElement.style.display = 'none';
    finalTotalElement.parentElement.style.display = 'none';

    scores.forEach((player, index) => {
        const standingDiv = document.createElement('div');
        standingDiv.className = 'standing-item';

        let medal = '';
        if (index === 0) medal = '🥇 ';
        else if (index === 1) medal = '🥈 ';
        else if (index === 2) medal = '🥉 ';

        standingDiv.textContent = `${medal}${index + 1}. ${player.name}: ${player.score}`;

        if (player.name === playerName) {
            standingDiv.style.fontWeight = 'bold';
            standingDiv.style.color = '#4CAF50';
        }

        finalStandings.appendChild(standingDiv);
    });

    showScreen('results');
}

function loadMultiplayerQuestion() {
    instructionText.textContent = 'Click on the zone in the map';
    instructionText.style.color = '#666'; // Reset color
    locationImage.src = currentLocation.image;
    gameStep = 'map';

    // Update game badge
    gameBadge.textContent = currentGame;

    // Apply random zoom to the location image
    applyRandomZoom(locationImage);

    // Update map to current game's general map
    gameMapImage.src = games[currentGame].generalMap;

    // Show map, hide options
    mapView.style.display = 'block';
    optionsView.style.display = 'none';

    // Hide next question button
    nextQuestionContainer.style.display = 'none';

    // Reset answer state
    hasAnswered = false;
    mySelectedAnswer = '';
    mySelectedButton = null;

    // Remove any previous click highlights
    const existingHighlights = gameMapContainer.querySelectorAll('.zone-click-highlight');
    existingHighlights.forEach(h => h.remove());
}

// ===========================================
// SINGLE PLAYER FUNCTIONS
// ===========================================
function initGame() {
    if (locations.length === 0) {
        alert('No locations available! Please add locations to locations.js');
        return;
    }

    currentQuestion = 0;
    score = 0;
    usedLocations = [];
    gameLocations = shuffleArray([...locations]);

    scoreElement.textContent = score;
    totalElement.textContent = gameLocations.length;
    currentElement.textContent = currentQuestion + 1;
    liveScoreboard.style.display = 'none';
    timerContainer.style.display = 'none';

    showScreen('game');
    loadQuestion();
}

function initGameWithZone(zoneName) {
    // Create questions: pick random locations from all games
    currentQuestion = 0;
    score = 0;
    gameLocations = [];
    gameAnswers = [];

    // Collect all locations from all games
    let allQuestionData = [];

    for (let gameName in games) {
        const gameData = games[gameName];
        const locationsInGame = Object.values(gameData.locationsByZone).flat();

        locationsInGame.forEach(location => {
            // Find which zone this location belongs to
            for (let zoneName in gameData.locationsByZone) {
                if (gameData.locationsByZone[zoneName].includes(location)) {
                    const zone = gameData.zones.find(z => z.name === zoneName);
                    allQuestionData.push({
                        game: gameName,
                        zone: zone,
                        location: location
                    });
                    break;
                }
            }
        });
    }

    // Shuffle and take up to 10 questions
    const shuffledLocations = shuffleArray(allQuestionData);
    gameLocations = shuffledLocations.slice(0, Math.min(10, shuffledLocations.length));

    scoreElement.textContent = score;
    totalElement.textContent = gameLocations.length;
    currentElement.textContent = currentQuestion + 1;
    liveScoreboard.style.display = 'none';
    timerContainer.style.display = 'none';

    showScreen('game');
    loadQuestion();
    initGameMapClickHandler();
}

function loadQuestion() {
    if (currentQuestion >= gameLocations.length) {
        showDetailedResults();
        return;
    }

    const questionData = gameLocations[currentQuestion];
    currentGame = questionData.game;
    currentZone = questionData.zone;
    currentLocation = questionData.location;

    currentElement.textContent = currentQuestion + 1;
    instructionText.textContent = 'Click on the zone in the map';
    instructionText.style.color = '#666'; // Reset color
    gameStep = 'map';

    // Update game badge
    gameBadge.textContent = currentGame;

    // Show the location image to find with random zoom
    locationImage.src = currentLocation.image;
    applyRandomZoom(locationImage);

    // Update map to current game's general map
    gameMapImage.src = games[currentGame].generalMap;

    // Show map, hide options
    mapView.style.display = 'block';
    optionsView.style.display = 'none';

    // Remove any previous click highlights
    const existingHighlights = gameMapContainer.querySelectorAll('.zone-click-highlight');
    existingHighlights.forEach(h => h.remove());
}

function applyRandomZoom(imageElement) {
    // Random zoom level between 1.2x and 2.5x
    const zoomLevel = 1.2 + Math.random() * 1.3; // 1.2 to 2.5

    // Random position to focus on (0-100%)
    const posX = Math.random() * 100;
    const posY = Math.random() * 100;

    // Use transform-origin to zoom from different points
    imageElement.style.transformOrigin = `${posX}% ${posY}%`;
    imageElement.style.transform = `scale(${zoomLevel})`;
}

function initGameMapClickHandler() {
    // Remove existing listeners
    const newGameMap = gameMapImage.cloneNode(true);
    gameMapImage.parentNode.replaceChild(newGameMap, gameMapImage);

    const gameMap = document.getElementById('game-map-image');

    gameMap.addEventListener('click', function(event) {
        if (gameStep !== 'map') return; // Only handle clicks when viewing map
        if (isMultiplayer && hasAnswered) return; // Don't allow clicks after answering in multiplayer

        const rect = gameMap.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 100;
        const y = ((event.clientY - rect.top) / rect.height) * 100;

        // Find which zone was clicked in the current game
        const clickedZone = detectZoneInGame(x, y);

        if (clickedZone) {
            showZoneOptions(clickedZone);
        }
    });
}

function detectZoneInGame(clickX, clickY) {
    // Only check zones from the current game
    const gameZones = games[currentGame].zones;

    for (let zone of gameZones) {
        const { x, y, width, height } = zone.clickArea;

        if (clickX >= x && clickX <= (x + width) &&
            clickY >= y && clickY <= (y + height)) {
            return zone;
        }
    }
    return null;
}

function showZoneOptions(clickedZone) {
    gameStep = 'options';
    selectedZoneNameEl.textContent = clickedZone.name;

    // Show options view, hide map
    mapView.style.display = 'none';
    optionsView.style.display = 'block';

    instructionText.textContent = 'Select the location';

    // Generate options from the clicked zone in the CURRENT GAME ONLY
    const currentGameData = games[currentGame];
    const zoneLocations = currentGameData.locationsByZone[clickedZone.name];

    if (!zoneLocations || zoneLocations.length === 0) {
        optionsContainer.innerHTML = '<p style="color: #666;">No locations available in this zone.</p>';
        return;
    }

    // Show ALL locations from the clicked zone (from current game only)
    let allOptions = shuffleArray([...zoneLocations]);

    optionsContainer.innerHTML = '';

    allOptions.forEach(location => {
        const button = document.createElement('button');
        button.className = 'option-btn';

        // Create image element
        const img = document.createElement('img');
        img.src = location.image;
        img.alt = location.name;

        // Create label element
        const label = document.createElement('div');
        label.className = 'option-label';
        label.textContent = location.name;

        button.appendChild(img);
        button.appendChild(label);

        if (isMultiplayer) {
            button.addEventListener('click', () => selectLocationMultiplayer(location.name, clickedZone.name, button));
        } else {
            button.addEventListener('click', () => selectLocation(location.name, clickedZone.name));
        }

        optionsContainer.appendChild(button);
    });
}

function selectLocation(selectedLocationName, selectedZoneName) {
    // Record the answer
    const isCorrect = (selectedLocationName === currentLocation.name && selectedZoneName === currentZone.name);

    gameAnswers.push({
        question: currentQuestion,
        game: currentGame,
        locationImage: currentLocation.image,
        correctZone: currentZone.name,
        correctLocation: currentLocation.name,
        selectedZone: selectedZoneName,
        selectedLocation: selectedLocationName,
        isCorrect: isCorrect
    });

    if (isCorrect) {
        score++;
        scoreElement.textContent = score;
    }

    // Disable all buttons and show feedback
    const allButtons = optionsContainer.querySelectorAll('.option-btn');
    allButtons.forEach(btn => btn.disabled = true);

    // Highlight correct and selected answers
    allButtons.forEach(btn => {
        const btnLabel = btn.querySelector('.option-label');
        if (btnLabel && btnLabel.textContent === currentLocation.name) {
            btn.classList.add('correct');
        }
        if (btnLabel && btnLabel.textContent === selectedLocationName && !isCorrect) {
            btn.classList.add('incorrect');
        }
    });

    // Show feedback message
    if (isCorrect) {
        instructionText.textContent = `Correct! ${currentLocation.name}`;
        instructionText.style.color = '#4CAF50';
    } else {
        instructionText.textContent = `Wrong! Correct answer: ${currentLocation.name} (${currentZone.name})`;
        instructionText.style.color = '#dc3545';
    }

    // Move to next question after delay
    currentQuestion++;
    setTimeout(() => {
        loadQuestion();
    }, 2500);
}

function selectLocationMultiplayer(selectedLocationName, selectedZoneName, button) {
    // Prevent multiple submissions
    if (hasAnswered) return;
    hasAnswered = true;

    // Store player's selection
    mySelectedAnswer = selectedLocationName;
    mySelectedButton = button;

    const allButtons = optionsContainer.querySelectorAll('.option-btn');
    allButtons.forEach(btn => btn.disabled = true);

    const timeTaken = Date.now() - questionStartTime;

    // Mark the selected answer
    button.style.opacity = '0.8';
    button.style.borderColor = '#667eea';
    button.style.boxShadow = '0 0 15px rgba(102, 126, 234, 0.5)';

    // Submit answer to server
    socket.emit('submitAnswer', {
        answer: selectedLocationName,
        timeTaken: timeTaken
    });
}

function goBackToMap() {
    // Don't allow going back in multiplayer if already answered
    if (isMultiplayer && hasAnswered) return;

    gameStep = 'map';
    instructionText.textContent = 'Click on the zone in the map';

    // Show map, hide options
    mapView.style.display = 'block';
    optionsView.style.display = 'none';
}

function showDetailedResults() {
    finalScoreElement.textContent = score;
    finalTotalElement.textContent = gameLocations.length;

    const percentage = Math.round((score / gameLocations.length) * 100);
    percentageElement.textContent = `${percentage}%`;

    // Show single-player elements, hide multiplayer
    percentageElement.style.display = 'block';
    finalTotalElement.parentElement.style.display = 'block';
    multiplayerResults.style.display = 'none';

    // Show detailed answer review
    showAnswerReview();

    showScreen('results');
}

function showAnswerReview() {
    // Create a detailed review section
    let reviewHTML = '<div style="margin-top: 30px; text-align: left;"><h3 style="text-align: center; color: #333;">Answer Review</h3>';

    gameAnswers.forEach((answer, index) => {
        const statusIcon = answer.isCorrect ? '✅' : '❌';
        const statusColor = answer.isCorrect ? '#28a745' : '#dc3545';

        reviewHTML += `
            <div style="background: #f8f9fa; padding: 15px; margin-bottom: 15px; border-radius: 8px; border-left: 4px solid ${statusColor};">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <strong style="font-size: 1.1em;">Question ${index + 1}</strong>
                    <span style="font-size: 1.3em;">${statusIcon}</span>
                </div>
                <div style="margin-bottom: 8px;">
                    <span style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 4px 12px; border-radius: 12px; font-size: 0.85em; font-weight: bold;">${answer.game}</span>
                </div>
                <div style="color: #666; margin-bottom: 5px;">
                    <strong>Correct Answer:</strong> ${answer.correctLocation} (${answer.correctZone})
                </div>
                <div style="color: ${statusColor};">
                    <strong>Your Answer:</strong> ${answer.selectedLocation} (${answer.selectedZone})
                </div>
            </div>
        `;
    });

    reviewHTML += '</div>';

    // Insert before the restart button
    const existingReview = document.getElementById('answer-review');
    if (existingReview) {
        existingReview.remove();
    }

    const reviewDiv = document.createElement('div');
    reviewDiv.id = 'answer-review';
    reviewDiv.innerHTML = reviewHTML;

    restartBtn.parentNode.insertBefore(reviewDiv, restartBtn);
}

function showResults() {
    showDetailedResults();
}

// ===========================================
// SHARED FUNCTIONS
// ===========================================
function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

function generateOptions(correctLocation) {
    // Use gameLocations if available (zone-specific), otherwise use all locations
    const locationPool = gameLocations.length > 0 ? gameLocations : locations;

    // Get up to 3 wrong locations (or fewer if not enough locations available)
    const availableWrongLocations = locationPool.filter(loc => loc.name !== correctLocation.name);
    const numWrongOptions = Math.min(3, availableWrongLocations.length);

    const wrongLocations = availableWrongLocations
        .sort(() => Math.random() - 0.5)
        .slice(0, numWrongOptions);

    const allOptions = shuffleArray([correctLocation, ...wrongLocations]);

    optionsContainer.innerHTML = '';

    allOptions.forEach(location => {
        const button = document.createElement('button');
        button.className = 'option-btn';
        button.textContent = location.name;
        button.style.opacity = '1';
        button.style.border = '2px solid #dee2e6';

        if (isMultiplayer) {
            button.addEventListener('click', () => checkMultiplayerAnswer(location.name, correctLocation.name, button));
        } else {
            button.addEventListener('click', () => checkAnswer(location.name, correctLocation.name, button));
        }

        optionsContainer.appendChild(button);
    });
}

function checkAnswer(selectedAnswer, correctAnswer, button) {
    const allButtons = optionsContainer.querySelectorAll('.option-btn');
    allButtons.forEach(btn => btn.disabled = true);

    if (selectedAnswer === correctAnswer) {
        button.classList.add('correct');
        feedbackElement.textContent = 'Correct!';
        feedbackElement.className = 'feedback correct';
        score++;
        scoreElement.textContent = score;
    } else {
        button.classList.add('incorrect');
        feedbackElement.textContent = `Wrong! It was ${correctAnswer}`;
        feedbackElement.className = 'feedback incorrect';

        allButtons.forEach(btn => {
            if (btn.textContent === correctAnswer) {
                btn.classList.add('correct');
            }
        });
    }

    currentQuestion++;
    setTimeout(() => {
        loadQuestion();
    }, 2000);
}

function checkMultiplayerAnswer(selectedAnswer, correctAnswer, button) {
    // Prevent multiple submissions
    if (hasAnswered) return;
    hasAnswered = true;

    // Store player's selection
    mySelectedAnswer = selectedAnswer;
    mySelectedButton = button;

    const allButtons = optionsContainer.querySelectorAll('.option-btn');
    allButtons.forEach(btn => btn.disabled = true);

    const timeTaken = Date.now() - questionStartTime;

    // Mark the selected answer (but don't show if it's correct yet)
    button.style.opacity = '0.7';
    button.style.border = '3px solid #667eea';

    socket.emit('submitAnswer', {
        answer: selectedAnswer,
        timeTaken: timeTaken
    });
}

// ===========================================
// EVENT LISTENERS
// ===========================================
singleplayerBtn.addEventListener('click', () => {
    isMultiplayer = false;
    // Start the game directly with all zones
    initGameWithZone('all');
});

multiplayerBtn.addEventListener('click', () => {
    isMultiplayer = true;
    if (!socket) initSocket();
    showScreen('lobby');
});

backToModeBtn.addEventListener('click', () => {
    showScreen('mode');
});

backBtn.addEventListener('click', () => {
    showScreen('mode');
});

// Back from zone screen
const backFromZoneBtn = document.getElementById('back-from-zone-btn');
backFromZoneBtn.addEventListener('click', () => {
    showScreen('mode');
});

// Back to map button
backToMapBtn.addEventListener('click', () => {
    goBackToMap();
});

createRoomBtn.addEventListener('click', () => {
    const name = createNameInput.value.trim();
    if (!name) {
        alert('Please enter your name');
        return;
    }
    socket.emit('createRoom', name);
});

joinRoomBtn.addEventListener('click', () => {
    const name = joinNameInput.value.trim();
    const code = roomCodeInput.value.trim().toUpperCase();

    if (!name) {
        alert('Please enter your name');
        return;
    }

    if (!code) {
        alert('Please enter a room code');
        return;
    }

    socket.emit('joinRoom', { roomCode: code, playerName: name });
});

readyBtn.addEventListener('click', () => {
    socket.emit('playerReady');
    readyBtn.disabled = true;
    readyBtn.textContent = 'Ready!';
});

startGameBtn.addEventListener('click', () => {
    if (locations.length === 0) {
        alert('No locations available! Please add locations to locations.js');
        return;
    }

    const gameLocationsData = shuffleArray([...locations]).map(loc => ({
        name: loc.name,
        image: loc.image,
        options: [] // Options will be generated client-side
    }));

    socket.emit('startGame', gameLocationsData);
});

leaveRoomBtn.addEventListener('click', () => {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
    showScreen('mode');
});

nextQuestionBtn.addEventListener('click', () => {
    // Hide the button immediately
    nextQuestionContainer.style.display = 'none';

    // Tell server to send next question
    if (socket) {
        socket.emit('nextQuestion');
    }
});

startBtn.addEventListener('click', initGame);

restartBtn.addEventListener('click', () => {
    if (isMultiplayer) {
        showScreen('waiting');
        readyBtn.disabled = false;
        readyBtn.textContent = 'Ready';
    } else {
        initGame();
    }
});

// ===========================================
// INITIALIZATION
// ===========================================
window.addEventListener('DOMContentLoaded', () => {
    totalElement.textContent = locations.length;
});
