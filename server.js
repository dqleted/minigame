const express = require('express');
const http = require('http');
const path = require('path');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",  // Consente connessioni da qualsiasi origine
    methods: ["GET", "POST"],
    credentials: false
  }
});

// Imposta la cartella pubblica per servire i file statici
app.use(express.static(path.join(__dirname, 'public')));

// Stato del gioco
const players = {};
const balls = [];
const matchmakingQueue = {}; // Coda di matchmaking per modalità
const activeGames = {}; // Partite attive
let gameIdCounter = 1; // Contatore per gli ID delle partite

// Configurazione del gioco
const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
const PLAYER_SIZE = 30;
const TARGET_RADIUS = 20;
const TARGET_SHRINK_SPEED = 0.1; // Velocità di riduzione del raggio
const MIN_TARGET_RADIUS = 5; // Raggio minimo prima di scomparire
const TARGETS_PER_GAME = 1; // Un target alla volta
const GAME_DURATION = 60; // Durata della partita in secondi

// Funzione per generare un colore casuale
function getRandomColor() {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

// Funzione per creare un target con posizione casuale
function createTarget() {
  return {
    x: Math.random() * (GAME_WIDTH - TARGET_RADIUS * 2) + TARGET_RADIUS,
    y: Math.random() * (GAME_HEIGHT - TARGET_RADIUS * 2) + TARGET_RADIUS,
    radius: TARGET_RADIUS,
    color: getRandomColor(),
    points: 10 // Punti base per colpire il target
  };
}

// Crea i target per una nuova partita
function createTargetsForGame() {
  const targets = [];
  for (let i = 0; i < TARGETS_PER_GAME; i++) {
    targets.push(createTarget());
  }
  return targets;
}

// Aggiorna la posizione delle palle
function updateBalls() {
  for (const ball of balls) {
    ball.x += ball.speedX;
    ball.y += ball.speedY;
    
    // Rimbalzo sui bordi
    if (ball.x - ball.radius <= 0 || ball.x + ball.radius >= GAME_WIDTH) {
      ball.speedX = -ball.speedX;
    }
    
    if (ball.y - ball.radius <= 0 || ball.y + ball.radius >= GAME_HEIGHT) {
      ball.speedY = -ball.speedY;
    }
  }
}

// Controlla le collisioni tra giocatori e palle
function checkCollisions() {
  for (const playerId in players) {
    const player = players[playerId];
    
    for (let i = 0; i < balls.length; i++) {
      const ball = balls[i];
      
      // Calcola la distanza tra il giocatore e la palla
      const dx = player.x - ball.x;
      const dy = player.y - ball.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Se c'è una collisione
      if (distance < player.size / 2 + ball.radius) {
        // Aumenta il punteggio del giocatore
        player.score += 1;
        
        // Rimuovi la palla e creane una nuova
        balls.splice(i, 1);
        balls.push(createBall());
        
        // Aggiorna il punteggio per tutti i client
        io.emit('updateScores', Object.values(players).map(p => ({
          id: p.id,
          name: p.name,
          score: p.score,
          color: p.color
        })));
        
        break;
      }
    }
  }
}

// Gestione delle connessioni Socket.io
io.on('connection', (socket) => {
  console.log('Un giocatore si è connesso:', socket.id);
  let playerGameId = null; // ID della partita a cui il giocatore è assegnato
  
  // Quando un giocatore entra in coda per il matchmaking
  socket.on('enterQueue', (data) => {
    const { name, gameMode } = data;
    
    // Verifica se la modalità è valida (per ora solo 1v1)
    if (gameMode !== '1v1') {
      socket.emit('matchmakingError', 'Modalità di gioco non disponibile');
      return;
    }
    
    console.log(`${name} è entrato nella coda per ${gameMode}`);
    
    // Inizializza la coda per questa modalità se non esiste
    if (!matchmakingQueue[gameMode]) {
      matchmakingQueue[gameMode] = [];
    }
    
    // Aggiungi il giocatore alla coda
    const playerInfo = {
      id: socket.id,
      name: name || `Giocatore ${Object.keys(players).length + 1}`,
      socket: socket
    };
    
    // Controlla se c'è già un giocatore in attesa
    if (matchmakingQueue[gameMode].length > 0) {
      // Abbiamo un match! Prendi il primo giocatore dalla coda
      const opponent = matchmakingQueue[gameMode].shift();
      
      // Crea una nuova partita
      const gameId = `game_${gameIdCounter++}`;
      
      // Inizializza le palle per questa partita
      const gameBalls = [];
      for (let i = 0; i < 10; i++) {
        gameBalls.push(createBall());
      }
      
      // Crea la partita
activeGames[gameId] = {
  id: gameId,
  mode: gameMode,
  players: {},
  targets: createTargetsForGame(),
  startTime: Date.now(),
  endTime: Date.now() + (GAME_DURATION * 1000)
};
      
      // Aggiungi entrambi i giocatori alla partita
      activeGames[gameId].players[opponent.id] = {
        id: opponent.id,
        name: opponent.name,
        x: Math.random() * (GAME_WIDTH - PLAYER_SIZE),
        y: Math.random() * (GAME_HEIGHT - PLAYER_SIZE),
        size: PLAYER_SIZE,
        color: getRandomColor(),
        score: 0
      };
      
      activeGames[gameId].players[socket.id] = {
        id: socket.id,
        name: playerInfo.name,
        x: Math.random() * (GAME_WIDTH - PLAYER_SIZE),
        y: Math.random() * (GAME_HEIGHT - PLAYER_SIZE),
        size: PLAYER_SIZE,
        color: getRandomColor(),
        score: 0
      };
      
      // Salva l'ID della partita per entrambi i giocatori
      playerGameId = gameId;
      
      // Fai entrare entrambi i giocatori nella stanza della partita
      opponent.socket.join(gameId);
      socket.join(gameId);
      
      // Notifica entrambi i giocatori che la partita è iniziata
      io.to(gameId).emit('gameStart', {
        gameId: gameId,
        players: Object.values(activeGames[gameId].players)
      });
      
      // Invia l'ID ai giocatori
      opponent.socket.emit('playerId', opponent.id);
      socket.emit('playerId', socket.id);
      
      console.log(`Partita ${gameId} iniziata tra ${playerInfo.name} e ${opponent.name}`);
    } else {
      // Nessun avversario disponibile, aggiungi il giocatore alla coda
      matchmakingQueue[gameMode].push(playerInfo);
      socket.emit('waitingForOpponent');
    }
  });
  
  // Quando un giocatore annulla la ricerca
  socket.on('cancelQueue', () => {
    // Rimuovi il giocatore da tutte le code
    for (const mode in matchmakingQueue) {
      matchmakingQueue[mode] = matchmakingQueue[mode].filter(player => player.id !== socket.id);
    }
    socket.emit('queueCancelled');
    console.log(`${socket.id} ha annullato la ricerca`);
  });
  
  // Quando un giocatore si muove
socket.on('playerMove', (position) => {
  // Se il giocatore è in una partita attiva
  if (playerGameId && activeGames[playerGameId] && activeGames[playerGameId].players[socket.id]) {
    activeGames[playerGameId].players[socket.id].x = position.x;
    activeGames[playerGameId].players[socket.id].y = position.y;
  }
});

// Quando un giocatore clicca
socket.on('playerClick', (position) => {
  // Se il giocatore è in una partita attiva
  if (playerGameId && activeGames[playerGameId] && activeGames[playerGameId].players[socket.id]) {
    const player = activeGames[playerGameId].players[socket.id];
    player.clicked = true;
    player.clickX = position.x;
    player.clickY = position.y;
  }
});
  
  // Quando un giocatore si disconnette
  socket.on('disconnect', () => {
    console.log('Un giocatore si è disconnesso:', socket.id);
    
    // Rimuovi il giocatore da tutte le code di matchmaking
    for (const mode in matchmakingQueue) {
      matchmakingQueue[mode] = matchmakingQueue[mode].filter(player => player.id !== socket.id);
    }
    
    // Se il giocatore era in una partita attiva
    if (playerGameId && activeGames[playerGameId]) {
      // Notifica l'altro giocatore che l'avversario si è disconnesso
      socket.to(playerGameId).emit('opponentDisconnected');
      
      // Rimuovi la partita
      delete activeGames[playerGameId];
    }
  });
});

// Funzione per aggiornare una partita specifica
function updateGame(gameId) {
  const game = activeGames[gameId];
  if (!game) return;
  
  // Controlla se la partita è terminata
  const currentTime = Date.now();
  if (currentTime >= game.endTime) {
    // Determina il vincitore
    const players = Object.values(game.players);
    players.sort((a, b) => b.score - a.score);
    
    // Invia il risultato finale ai client
    io.to(gameId).emit('gameOver', {
      players: players.map(p => ({
        id: p.id,
        name: p.name,
        score: p.score,
        color: p.color
      })),
      timeLeft: 0
    });
    
    // Rimuovi la partita dopo un breve ritardo
    setTimeout(() => {
      delete activeGames[gameId];
    }, 5000);
    
    return;
  }
  
  // Aggiorna i target (riduci la dimensione)
  for (let i = 0; i < game.targets.length; i++) {
    const target = game.targets[i];
    target.radius -= TARGET_SHRINK_SPEED;
    
    // Se il target diventa troppo piccolo, creane uno nuovo
    if (target.radius <= MIN_TARGET_RADIUS) {
      game.targets[i] = createTarget();
    }
  }
  
  // Controlla le collisioni (click sui target)
  for (const playerId in game.players) {
    const player = game.players[playerId];
    
    // Se il giocatore ha cliccato
    if (player.clicked) {
      for (let i = 0; i < game.targets.length; i++) {
        const target = game.targets[i];
        
        // Calcola la distanza tra il click e il target
        const dx = player.clickX - target.x;
        const dy = player.clickY - target.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Se il click è sul target
        if (distance < target.radius) {
          // Calcola i punti in base alla dimensione del target
          // Più piccolo è il target, più punti si ottengono
          const pointsMultiplier = (TARGET_RADIUS / target.radius);
          const pointsEarned = Math.round(target.points * pointsMultiplier);
          
          // Aumenta il punteggio del giocatore
          player.score += pointsEarned;
          
          // Mostra un effetto visivo per i punti guadagnati
          io.to(gameId).emit('targetHit', {
            x: target.x,
            y: target.y,
            points: pointsEarned,
            playerId: player.id
          });
          
          // Crea un nuovo target
          game.targets[i] = createTarget();
          
          // Aggiorna il punteggio per tutti i client nella partita
          io.to(gameId).emit('updateScores', Object.values(game.players).map(p => ({
            id: p.id,
            name: p.name,
            score: p.score,
            color: p.color
          })));
          
          break;
        }
      }
      
      // Resetta lo stato del click
      player.clicked = false;
    }
  }
  
  // Calcola il tempo rimanente
  const timeLeft = Math.max(0, Math.floor((game.endTime - currentTime) / 1000));
  
  // Invia gli aggiornamenti ai client nella partita
  io.to(gameId).emit('updateTargets', game.targets);
  io.to(gameId).emit('updatePlayers', Object.values(game.players));
  io.to(gameId).emit('updateTime', timeLeft);
}

// Loop principale del gioco che aggiorna tutte le partite attive
setInterval(() => {
  for (const gameId in activeGames) {
    updateGame(gameId);
  }
}, 1000 / 60); // 60 FPS

// Avvia il server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server avviato sulla porta ${PORT}`);
});