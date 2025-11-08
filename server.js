const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

// Serve static files
app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Store active game rooms
const rooms = new Map();

// Generate a random 6-character room code
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Create a new room
  socket.on('createRoom', (playerName) => {
    let roomCode = generateRoomCode();

    // Ensure room code is unique
    while (rooms.has(roomCode)) {
      roomCode = generateRoomCode();
    }

    const room = {
      code: roomCode,
      host: socket.id,
      players: new Map(),
      gameState: {
        started: false,
        currentQuestion: 0,
        questions: [],
        scores: new Map(),
        answeredPlayers: new Set(),
        timer: null,
        questionStartTime: null
      }
    };

    room.players.set(socket.id, {
      id: socket.id,
      name: playerName,
      score: 0,
      ready: false
    });

    rooms.set(roomCode, room);
    socket.join(roomCode);
    socket.roomCode = roomCode;

    socket.emit('roomCreated', {
      roomCode,
      playerName,
      isHost: true
    });

    console.log(`Room ${roomCode} created by ${playerName}`);
  });

  // Join an existing room
  socket.on('joinRoom', ({ roomCode, playerName }) => {
    roomCode = roomCode.toUpperCase();
    const room = rooms.get(roomCode);

    if (!room) {
      socket.emit('error', 'Room not found');
      return;
    }

    if (room.gameState.started) {
      socket.emit('error', 'Game already in progress');
      return;
    }

    room.players.set(socket.id, {
      id: socket.id,
      name: playerName,
      score: 0,
      ready: false
    });

    socket.join(roomCode);
    socket.roomCode = roomCode;

    socket.emit('roomJoined', {
      roomCode,
      playerName,
      isHost: socket.id === room.host
    });

    // Broadcast updated player list to all players in room
    const playerList = Array.from(room.players.values());
    io.to(roomCode).emit('playerListUpdated', playerList);

    console.log(`${playerName} joined room ${roomCode}`);
  });

  // Player ready
  socket.on('playerReady', () => {
    const roomCode = socket.roomCode;
    if (!roomCode) return;

    const room = rooms.get(roomCode);
    if (!room) return;

    const player = room.players.get(socket.id);
    if (player) {
      player.ready = true;
      const playerList = Array.from(room.players.values());
      io.to(roomCode).emit('playerListUpdated', playerList);
    }
  });

  // Start game (host only)
  socket.on('startGame', (gameLocations) => {
    const roomCode = socket.roomCode;
    if (!roomCode) return;

    const room = rooms.get(roomCode);
    if (!room || socket.id !== room.host) {
      socket.emit('error', 'Only the host can start the game');
      return;
    }

    room.gameState.started = true;
    room.gameState.currentQuestion = 0;
    room.gameState.questions = gameLocations;

    // Initialize scores
    room.players.forEach((player, id) => {
      room.gameState.scores.set(id, 0);
      player.score = 0;
    });

    io.to(roomCode).emit('gameStarted', {
      totalQuestions: gameLocations.length
    });

    // Send first question after a short delay
    setTimeout(() => {
      sendNextQuestion(roomCode);
    }, 1000);

    console.log(`Game started in room ${roomCode}`);
  });

  // Submit answer
  socket.on('submitAnswer', ({ answer, timeTaken }) => {
    const roomCode = socket.roomCode;
    if (!roomCode) return;

    const room = rooms.get(roomCode);
    if (!room || !room.gameState.started) return;

    // Prevent duplicate submissions
    if (room.gameState.answeredPlayers.has(socket.id)) {
      return;
    }

    // Fix: currentQuestion is 1-indexed, but array is 0-indexed
    const currentQ = room.gameState.currentQuestion - 1;

    // Validate question index
    if (currentQ < 0 || currentQ >= room.gameState.questions.length) {
      console.error(`Invalid question index: ${currentQ}`);
      return;
    }

    const correctAnswer = room.gameState.questions[currentQ].name;
    const isCorrect = answer === correctAnswer;

    // Calculate points (bonus for speed - max 500ms bonus)
    let points = 0;
    if (isCorrect) {
      points = 1000;
      const timeBonus = Math.max(0, 500 - timeTaken);
      points += Math.floor(timeBonus);
    }

    // Update score
    const currentScore = room.gameState.scores.get(socket.id) || 0;
    room.gameState.scores.set(socket.id, currentScore + points);

    const player = room.players.get(socket.id);
    if (player) {
      player.score = currentScore + points;
    }

    // Track that this player has answered (before sending results)
    room.gameState.answeredPlayers.add(socket.id);

    // Send result to player
    socket.emit('answerResult', {
      isCorrect,
      correctAnswer,
      points,
      totalScore: currentScore + points
    });

    // Broadcast scores to all players
    const scoreList = Array.from(room.players.values()).map(p => ({
      name: p.name,
      score: p.score
    }));
    io.to(roomCode).emit('scoresUpdated', scoreList);

    // Check if all players have answered
    if (room.gameState.answeredPlayers.size === room.players.size) {
      // Clear the timer since everyone answered
      if (room.gameState.timer) {
        clearTimeout(room.gameState.timer);
        room.gameState.timer = null;
      }

      // Notify all players that everyone has answered
      io.to(roomCode).emit('allAnswered', {
        correctAnswer: room.gameState.questions[currentQ].name
      });

      // Notify host to show next question button
      io.to(room.host).emit('allPlayersAnswered');
    }
  });

  // Next question (automatically triggered after time limit)
  socket.on('nextQuestion', () => {
    const roomCode = socket.roomCode;
    if (!roomCode) return;

    const room = rooms.get(roomCode);
    if (!room || socket.id !== room.host) return;

    sendNextQuestion(roomCode);
  });

  // Disconnect
  socket.on('disconnect', () => {
    const roomCode = socket.roomCode;
    if (roomCode) {
      const room = rooms.get(roomCode);
      if (room) {
        room.players.delete(socket.id);

        // If host left, assign new host or delete room
        if (socket.id === room.host) {
          if (room.players.size > 0) {
            const newHost = room.players.keys().next().value;
            room.host = newHost;
            io.to(newHost).emit('promotedToHost');
          } else {
            rooms.delete(roomCode);
            console.log(`Room ${roomCode} deleted (empty)`);
            return;
          }
        }

        // Update player list
        const playerList = Array.from(room.players.values());
        io.to(roomCode).emit('playerListUpdated', playerList);
      }
    }

    console.log('User disconnected:', socket.id);
  });
});

// Helper function to send next question
function sendNextQuestion(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;

  // Clear any existing timer
  if (room.gameState.timer) {
    clearTimeout(room.gameState.timer);
    room.gameState.timer = null;
  }

  room.gameState.currentQuestion++;
  const questionIndex = room.gameState.currentQuestion - 1;

  if (questionIndex >= room.gameState.questions.length) {
    // Game over
    const finalScores = Array.from(room.players.values())
      .map(p => ({
        name: p.name,
        score: p.score
      }))
      .sort((a, b) => b.score - a.score);

    io.to(roomCode).emit('gameOver', {
      scores: finalScores
    });

    room.gameState.started = false;
    console.log(`Game ended in room ${roomCode}`);
    return;
  }

  const question = room.gameState.questions[questionIndex];

  // Clear answered players for new question
  room.gameState.answeredPlayers.clear();

  // Record question start time
  room.gameState.questionStartTime = Date.now();

  io.to(roomCode).emit('newQuestion', {
    questionNumber: room.gameState.currentQuestion,
    totalQuestions: room.gameState.questions.length,
    image: question.image,
    correctAnswer: question.name // Send correct answer for client validation
  });

  // Start 30-second timer
  room.gameState.timer = setTimeout(() => {
    handleTimeExpired(roomCode);
  }, 30000);

  console.log(`Question ${room.gameState.currentQuestion} sent to room ${roomCode}`);
}

// Handle when timer expires
function handleTimeExpired(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;

  console.log(`Timer expired for room ${roomCode}`);

  // Notify all players that time is up
  io.to(roomCode).emit('timeExpired', {
    correctAnswer: room.gameState.questions[room.gameState.currentQuestion - 1].name
  });

  // Notify host to show next question button
  io.to(room.host).emit('allPlayersAnswered');
}

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
});
