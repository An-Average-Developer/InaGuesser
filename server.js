const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static(__dirname));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// Active rooms: Map<roomCode, room>
const rooms = new Map();

function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
}

function uniqueRoomCode() {
    let code;
    do { code = generateRoomCode(); } while (rooms.has(code));
    return code;
}

io.on('connection', socket => {
    console.log('Connected:', socket.id);

    // ── Create room ──────────────────────────────────────────────────
    socket.on('createRoom', playerName => {
        const roomCode = uniqueRoomCode();
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
                playerAttempts: new Map(),
                timer: null,
            },
        };

        room.players.set(socket.id, { id: socket.id, name: playerName, score: 0, ready: false });
        rooms.set(roomCode, room);
        socket.join(roomCode);
        socket.roomCode = roomCode;

        socket.emit('roomCreated', { roomCode, playerName, isHost: true });
        console.log(`Room ${roomCode} created by ${playerName}`);
    });

    // ── Join room ─────────────────────────────────────────────────────
    socket.on('joinRoom', ({ roomCode, playerName }) => {
        roomCode = roomCode.toUpperCase();
        const room = rooms.get(roomCode);

        if (!room)                   { socket.emit('error', 'Room not found');           return; }
        if (room.gameState.started)  { socket.emit('error', 'Game already in progress'); return; }

        room.players.set(socket.id, { id: socket.id, name: playerName, score: 0, ready: false });
        socket.join(roomCode);
        socket.roomCode = roomCode;

        socket.emit('roomJoined', { roomCode, playerName, isHost: socket.id === room.host });
        io.to(roomCode).emit('playerListUpdated', [...room.players.values()]);
        console.log(`${playerName} joined ${roomCode}`);
    });

    // ── Player ready ──────────────────────────────────────────────────
    socket.on('playerReady', () => {
        const room = rooms.get(socket.roomCode);
        if (!room) return;
        const player = room.players.get(socket.id);
        if (player) {
            player.ready = true;
            io.to(socket.roomCode).emit('playerListUpdated', [...room.players.values()]);
        }
    });

    // ── Start game (host only) ────────────────────────────────────────
    socket.on('startGame', gameLocations => {
        const room = rooms.get(socket.roomCode);
        if (!room || socket.id !== room.host) {
            socket.emit('error', 'Only the host can start the game');
            return;
        }

        room.gameState.started         = true;
        room.gameState.currentQuestion = 0;
        room.gameState.questions       = gameLocations;

        room.players.forEach((player, id) => {
            room.gameState.scores.set(id, 0);
            player.score = 0;
        });

        io.to(socket.roomCode).emit('gameStarted', { totalQuestions: gameLocations.length });

        setTimeout(() => sendNextQuestion(socket.roomCode), 1000);
        console.log(`Game started in ${socket.roomCode}`);
    });

    // ── Submit answer ─────────────────────────────────────────────────
    socket.on('submitAnswer', ({ answer, timeTaken, textMode }) => {
        const room = rooms.get(socket.roomCode);
        if (!room || !room.gameState.started) return;
        if (room.gameState.answeredPlayers.has(socket.id)) return;

        const qi = room.gameState.currentQuestion - 1;
        if (qi < 0 || qi >= room.gameState.questions.length) return;

        const correctAnswer = room.gameState.questions[qi].name;

        let isCorrect;
        if (textMode) {
            const norm = s => s.toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '');
            isCorrect = norm(answer) === norm(correctAnswer);
        } else {
            isCorrect = answer === correctAnswer;
        }

        // Text mode: allow up to 3 attempts before marking as done
        if (textMode && !isCorrect) {
            const attempts = (room.gameState.playerAttempts.get(socket.id) || 0) + 1;
            room.gameState.playerAttempts.set(socket.id, attempts);
            const attemptsLeft = 3 - attempts;

            if (attemptsLeft > 0) {
                const currentScore = room.gameState.scores.get(socket.id) || 0;
                socket.emit('answerResult', { isCorrect: false, attemptsLeft, points: 0, totalScore: currentScore });
                return;
            }
            // All 3 tries used — fall through to finalize
        }

        let points = 0;
        if (isCorrect) {
            points = 1000 + Math.floor(Math.max(0, 500 - timeTaken));
        }

        const prev = room.gameState.scores.get(socket.id) || 0;
        const total = prev + points;
        room.gameState.scores.set(socket.id, total);

        const player = room.players.get(socket.id);
        if (player) player.score = total;

        room.gameState.answeredPlayers.add(socket.id);

        socket.emit('answerResult', { isCorrect, correctAnswer, points, totalScore: total, attemptsLeft: 0 });

        const scoreList = [...room.players.values()].map(p => ({ name: p.name, score: p.score }));
        io.to(socket.roomCode).emit('scoresUpdated', scoreList);

        if (room.gameState.answeredPlayers.size === room.players.size) {
            clearTimeout(room.gameState.timer);
            room.gameState.timer = null;
            io.to(socket.roomCode).emit('allAnswered', { correctAnswer });
            io.to(room.host).emit('allPlayersAnswered');
        }
    });

    // ── Next question (host only) ─────────────────────────────────────
    socket.on('nextQuestion', () => {
        const room = rooms.get(socket.roomCode);
        if (!room || socket.id !== room.host) return;
        sendNextQuestion(socket.roomCode);
    });

    // ── Disconnect ────────────────────────────────────────────────────
    socket.on('disconnect', () => {
        const roomCode = socket.roomCode;
        if (roomCode) {
            const room = rooms.get(roomCode);
            if (room) {
                room.players.delete(socket.id);

                if (socket.id === room.host) {
                    if (room.players.size > 0) {
                        const newHostId = room.players.keys().next().value;
                        room.host = newHostId;
                        io.to(newHostId).emit('promotedToHost');
                    } else {
                        clearTimeout(room.gameState.timer);
                        rooms.delete(roomCode);
                        console.log(`Room ${roomCode} deleted (empty)`);
                        return;
                    }
                }

                io.to(roomCode).emit('playerListUpdated', [...room.players.values()]);
            }
        }
        console.log('Disconnected:', socket.id);
    });
});

// ── Send next question ────────────────────────────────────────────────
function sendNextQuestion(roomCode) {
    const room = rooms.get(roomCode);
    if (!room) return;

    clearTimeout(room.gameState.timer);
    room.gameState.timer = null;
    room.gameState.currentQuestion++;

    const qi = room.gameState.currentQuestion - 1;

    if (qi >= room.gameState.questions.length) {
        const finalScores = [...room.players.values()]
            .map(p => ({ name: p.name, score: p.score }))
            .sort((a, b) => b.score - a.score);

        io.to(roomCode).emit('gameOver', { scores: finalScores });
        room.gameState.started = false;
        console.log(`Game ended in ${roomCode}`);
        return;
    }

    room.gameState.answeredPlayers.clear();
    room.gameState.playerAttempts.clear();

    const question = room.gameState.questions[qi];
    io.to(roomCode).emit('newQuestion', {
        questionNumber: room.gameState.currentQuestion,
        totalQuestions: room.gameState.questions.length,
        image: question.image,
        // correctAnswer intentionally omitted — clients should not know it in advance
    });

    room.gameState.timer = setTimeout(() => {
        const r = rooms.get(roomCode);
        if (!r) return;
        io.to(roomCode).emit('timeExpired', { correctAnswer: r.gameState.questions[qi].name });
        io.to(r.host).emit('allPlayersAnswered');
    }, 30000);

    console.log(`Q${room.gameState.currentQuestion} → ${roomCode}`);
}

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Server on http://localhost:${PORT}`));
