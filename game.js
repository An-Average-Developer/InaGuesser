// Game state
let currentQuestion = 0;
let score = 0;
let gameLocations = [];
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

// DOM elements - Screens
const modeScreen = document.getElementById('mode-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const waitingScreen = document.getElementById('waiting-screen');
const startScreen = document.getElementById('start-screen');
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
const locationImage = document.getElementById('location-image');
const optionsContainer = document.getElementById('options-container');
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
        timerContainer.style.display = 'none';
        hasAnswered = false;
        mySelectedAnswer = '';
        mySelectedButton = null;
        showScreen('game');
    });

    socket.on('newQuestion', ({ questionNumber, totalQuestions, image, correctAnswer }) => {
        currentQuestion = questionNumber;
        currentElement.textContent = questionNumber;
        totalElement.textContent = totalQuestions;
        currentCorrectAnswer = correctAnswer;

        // Find the location from the image
        const location = locations.find(loc => loc.image === image);
        if (location) {
            loadMultiplayerQuestion(location);
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
        feedbackElement.textContent = 'Answer submitted! Waiting for other players...';
        feedbackElement.className = 'feedback';
        feedbackElement.style.color = '#667eea';
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
        showCorrectAnswer(correctAnswer);

        // Show personalized feedback based on whether player answered
        if (hasAnswered) {
            if (mySelectedAnswer === correctAnswer) {
                feedbackElement.textContent = `Time's up! You were correct: ${correctAnswer}`;
                feedbackElement.className = 'feedback correct';
                feedbackElement.style.color = '#4CAF50';
            } else {
                feedbackElement.textContent = `Time's up! You selected "${mySelectedAnswer}". Correct answer: ${correctAnswer}`;
                feedbackElement.className = 'feedback incorrect';
                feedbackElement.style.color = '#dc3545';
            }
        } else {
            feedbackElement.textContent = `Time's up! You didn't answer. Correct answer: ${correctAnswer}`;
            feedbackElement.className = 'feedback incorrect';
            feedbackElement.style.color = '#dc3545';
        }
    });

    socket.on('allAnswered', ({ correctAnswer }) => {
        // Everyone answered - show message and complete timer quickly
        feedbackElement.textContent = 'Everyone answered!';
        feedbackElement.className = 'feedback';
        feedbackElement.style.color = '#667eea';
        feedbackElement.style.fontWeight = 'bold';

        completeTimerInstantly(() => {
            disableAllOptions();
            showCorrectAnswer(correctAnswer);

            // Show personalized feedback
            if (mySelectedAnswer === correctAnswer) {
                feedbackElement.textContent = `Correct! The answer was ${correctAnswer}`;
                feedbackElement.className = 'feedback correct';
                feedbackElement.style.color = '#4CAF50';
            } else if (hasAnswered) {
                feedbackElement.textContent = `Wrong! You selected "${mySelectedAnswer}". Correct answer: ${correctAnswer}`;
                feedbackElement.className = 'feedback incorrect';
                feedbackElement.style.color = '#dc3545';
            } else {
                feedbackElement.textContent = `Time's up! Correct answer: ${correctAnswer}`;
                feedbackElement.className = 'feedback incorrect';
                feedbackElement.style.color = '#dc3545';
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
    gameScreen.classList.remove('active');
    resultsScreen.classList.remove('active');

    if (screenName === 'mode') modeScreen.classList.add('active');
    else if (screenName === 'lobby') lobbyScreen.classList.add('active');
    else if (screenName === 'waiting') waitingScreen.classList.add('active');
    else if (screenName === 'start') startScreen.classList.add('active');
    else if (screenName === 'game') gameScreen.classList.add('active');
    else if (screenName === 'results') resultsScreen.classList.add('active');
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

function showCorrectAnswer(correctAnswer) {
    const allButtons = optionsContainer.querySelectorAll('.option-btn');
    allButtons.forEach(btn => {
        // Reset styling
        btn.style.opacity = '1';
        btn.style.border = '2px solid #dee2e6';

        // Highlight correct answer in green
        if (btn.textContent === correctAnswer) {
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

function loadMultiplayerQuestion(currentLocation) {
    locationImage.src = currentLocation.image;
    locationImage.alt = "Guess this location!";
    feedbackElement.textContent = '';
    feedbackElement.className = 'feedback';
    feedbackElement.style.color = '';

    // Hide next question button
    nextQuestionContainer.style.display = 'none';

    // Reset answer state
    hasAnswered = false;
    mySelectedAnswer = '';
    mySelectedButton = null;

    // Generate options with randomization for each player
    generateOptions(currentLocation);
}

// ===========================================
// SINGLE PLAYER FUNCTIONS
// ===========================================
function initGame() {
    if (locations.length < 4) {
        alert('You need at least 4 locations to play! Please add more locations to locations.js');
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

function loadQuestion() {
    if (currentQuestion >= gameLocations.length) {
        showResults();
        return;
    }

    const currentLocation = gameLocations[currentQuestion];
    usedLocations.push(currentLocation);

    currentElement.textContent = currentQuestion + 1;
    locationImage.src = currentLocation.image;
    locationImage.alt = "Guess this location!";
    feedbackElement.textContent = '';
    feedbackElement.className = 'feedback';

    generateOptions(currentLocation);
}

function showResults() {
    finalScoreElement.textContent = score;
    finalTotalElement.textContent = gameLocations.length;

    const percentage = Math.round((score / gameLocations.length) * 100);
    percentageElement.textContent = `${percentage}%`;

    // Show single-player elements, hide multiplayer
    percentageElement.style.display = 'block';
    finalTotalElement.parentElement.style.display = 'block';
    multiplayerResults.style.display = 'none';

    showScreen('results');
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
    const wrongLocations = locations
        .filter(loc => loc.name !== correctLocation.name)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);

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
    showScreen('start');
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
    if (locations.length < 4) {
        alert('You need at least 4 locations to play! Please add more locations to locations.js');
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
