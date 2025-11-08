# Inazuma Eleven GeoGuesser - Multiplayer Edition

A fun multiplayer quiz game where players identify iconic locations from the Inazuma Eleven series!

## Features

### Single Player Mode
- Play solo through all locations
- Immediate feedback on answers
- Score tracking and percentage

### Multiplayer Mode
- **Room-based system** with 6-character room codes
- **Real-time gameplay** - all players see the same questions
- **30-second timer** per question with visual countdown
- **Speed bonus scoring** - faster correct answers earn more points (up to +500 points)
- **Randomized answer positions** - each player sees options in different order
- **Live scoreboard** - see how you rank against others in real-time
- **Host controls** - room creator can start game and advance questions
- **Auto-advance** - when everyone answers OR timer expires, show correct answer
- **Host-controlled progression** - host clicks "Next Question" when ready

## How to Play

### Single Player
1. Click "Single Player"
2. Click "Start Game"
3. Identify each location
4. See your final score!

### Multiplayer
1. **Create a Room:**
   - Click "Multiplayer"
   - Enter your name
   - Click "Create Room"
   - Share the room code with friends

2. **Join a Room:**
   - Click "Multiplayer"
   - Enter your name and the room code
   - Click "Join Room"
   - Wait for host to start

3. **Play:**
   - Host clicks "Start Game" when everyone is ready
   - Each question has a 30-second timer
   - Click your answer - you can only answer once!
   - When everyone answers, timer completes instantly (animates to 0)
   - Correct answer is revealed after timer completes OR expires
   - Host clicks "Next Question" to continue
   - After all questions, see final rankings with medals!

## Scoring (Multiplayer)

- **Correct Answer:** 1000 points
- **Speed Bonus:** Up to +500 points (faster = more points)
- **Wrong Answer:** 0 points

## Running the Game

### Local Development
```bash
# Install dependencies
npm install

# Start the server
npm start

# Open browser to http://localhost:3000
```

### Deployment
See [DEPLOYMENT.md](DEPLOYMENT.md) for hosting options.

Recommended: **Railway.app** - Easy deployment with one click!

## Technical Features

- **Node.js + Express** - Backend server
- **Socket.io** - Real-time multiplayer communication
- **Client-side randomization** - Each player sees different option orders
- **Timer synchronization** - Consistent 30-second countdown for all players
- **Automatic room cleanup** - Rooms are deleted when empty
- **Host migration** - If host leaves, a new host is assigned

## Game Flow (Multiplayer)

1. Players join room
2. Host starts game
3. For each question:
   - 30-second timer starts
   - All players see same image, different option orders
   - Players submit answers
   - When ALL answer → timer animates to 0 (1 second) → show correct answer
   - OR timer expires naturally → show correct answer
   - Host clicks "Next Question"
4. After all questions → final rankings with medals

## Browser Support

Works in all modern browsers:
- Chrome/Edge
- Firefox
- Safari
- Opera

Requires JavaScript enabled.

## Credits

Created with Claude Code

Inazuma Eleven © Level-5
