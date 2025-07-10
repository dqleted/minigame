// Connessione al server Socket.io
const socket = io();

// Elementi del DOM
const welcomeScreen = document.getElementById('welcome-screen');
const matchmakingScreen = document.getElementById('matchmaking-screen');
const gameScreen = document.getElementById('game-screen');
const playerNameInput = document.getElementById('player-name');
const startButton = document.getElementById('start-button');
const cancelButton = document.getElementById('cancel-button');
const scoreboard = document.getElementById('scoreboard');
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const waitingMessage = document.getElementById('waiting-message');
const modeButtons = document.querySelectorAll('.mode-button');

// Variabili di gioco
let playerId = null;
let players = {};
let targets = [];
let mouseX = 0;
let mouseY = 0;
let selectedGameMode = '1v1'; // Modalità di gioco predefinita
let timeLeft = 0; // Tempo rimanente nella partita
let gameActive = false; // Indica se la partita è attiva

// Dimensioni del gioco
const GAME_WIDTH = canvas.width;
const GAME_HEIGHT = canvas.height;

// Gestione degli eventi del mouse
canvas.addEventListener('mousemove', (event) => {
  const rect = canvas.getBoundingClientRect();
  mouseX = event.clientX - rect.left;
  mouseY = event.clientY - rect.top;
  
  // Invia la posizione al server
  if (playerId && gameActive) {
    socket.emit('playerMove', { x: mouseX, y: mouseY });
  }
});

// Gestione del click del mouse
canvas.addEventListener('click', (event) => {
  if (!playerId || !gameActive) return;
  
  const rect = canvas.getBoundingClientRect();
  const clickX = event.clientX - rect.left;
  const clickY = event.clientY - rect.top;
  
  // Invia la posizione del click al server
  socket.emit('playerClick', { x: clickX, y: clickY });
  
  // Effetto visivo del click
  drawClickEffect(clickX, clickY);
});

// Gestione dei pulsanti di selezione modalità
modeButtons.forEach(button => {
  button.addEventListener('click', () => {
    // Ignora i pulsanti disabilitati
    if (button.classList.contains('disabled')) return;
    
    // Rimuovi la classe 'active' da tutti i pulsanti
    modeButtons.forEach(btn => btn.classList.remove('active'));
    
    // Aggiungi la classe 'active' al pulsante cliccato
    button.classList.add('active');
    
    // Imposta la modalità selezionata
    selectedGameMode = button.getAttribute('data-mode');
  });
});

// Gestione del pulsante di inizio matchmaking
startButton.addEventListener('click', () => {
  const playerName = playerNameInput.value.trim();
  
  // Verifica che il nome sia stato inserito
  if (!playerName) {
    alert('Per favore, inserisci il tuo nome!');
    return;
  }
  
  // Entra nella coda di matchmaking
  socket.emit('enterQueue', {
    name: playerName,
    gameMode: selectedGameMode
  });
  
  // Nascondi la schermata di benvenuto e mostra la schermata di attesa
  welcomeScreen.style.display = 'none';
  matchmakingScreen.style.display = 'block';
});

// Gestione del pulsante di annullamento matchmaking
cancelButton.addEventListener('click', () => {
  // Annulla la ricerca
  socket.emit('cancelQueue');
  
  // Torna alla schermata di benvenuto
  matchmakingScreen.style.display = 'none';
  welcomeScreen.style.display = 'block';
});

// Permetti di iniziare anche premendo Invio
playerNameInput.addEventListener('keypress', (event) => {
  if (event.key === 'Enter') {
    startButton.click();
  }
});

// Gestione degli eventi di matchmaking
socket.on('waitingForOpponent', () => {
  waitingMessage.textContent = 'In attesa di un avversario...';
});

socket.on('matchmakingError', (errorMessage) => {
  alert(`Errore: ${errorMessage}`);
  matchmakingScreen.style.display = 'none';
  welcomeScreen.style.display = 'block';
});

socket.on('queueCancelled', () => {
  console.log('Ricerca annullata');
});

// Quando la partita inizia
socket.on('gameStart', (gameData) => {
  console.log('Partita iniziata!', gameData);
  
  // Nascondi la schermata di matchmaking e mostra il gioco
  matchmakingScreen.style.display = 'none';
  gameScreen.style.display = 'block';
  
  // Imposta lo stato della partita come attivo
  gameActive = true;
  
  // Resetta il punteggio
  players = {};
  targets = [];
});

// Quando l'avversario si disconnette
socket.on('opponentDisconnected', () => {
  alert('L\'avversario si è disconnesso. Tornerai alla schermata principale.');
  
  // Torna alla schermata di benvenuto
  gameScreen.style.display = 'none';
  welcomeScreen.style.display = 'block';
});

// Ricevi l'ID del giocatore dal server
socket.on('playerId', (id) => {
  playerId = id;
});

// Aggiorna la lista dei giocatori
socket.on('updatePlayers', (updatedPlayers) => {
  players = {};
  updatedPlayers.forEach(player => {
    players[player.id] = player;
  });
});

// Aggiorna i target
socket.on('updateTargets', (updatedTargets) => {
  targets = updatedTargets;
});

// Aggiorna il tempo rimanente
socket.on('updateTime', (remainingTime) => {
  timeLeft = remainingTime;
});

// Quando un target viene colpito
socket.on('targetHit', (hitData) => {
  // Effetto visivo quando un target viene colpito
  showPointsAnimation(hitData.x, hitData.y, hitData.points, hitData.playerId === playerId);
});

// Quando la partita termina
socket.on('gameOver', (results) => {
  gameActive = false;
  
  // Mostra i risultati finali
  showGameResults(results.players);
});

// Aggiorna i punteggi
socket.on('updateScores', (playerScores) => {
  // Ordina i giocatori per punteggio (dal più alto al più basso)
  playerScores.sort((a, b) => b.score - a.score);
  
  // Aggiorna la tabella dei punteggi
  scoreboard.innerHTML = '';
  
  playerScores.forEach(player => {
    const scoreElement = document.createElement('div');
    scoreElement.className = 'player-score';
    scoreElement.style.backgroundColor = player.color;
    scoreElement.textContent = `${player.name}: ${player.score}`;
    
    // Evidenzia il giocatore corrente
    if (player.id === playerId) {
      scoreElement.style.border = '2px solid black';
    }
    
    scoreboard.appendChild(scoreElement);
  });
});

// Funzione per disegnare un giocatore
function drawPlayer(player) {
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.size / 2, 0, Math.PI * 2);
  ctx.fillStyle = player.color;
  ctx.fill();
  ctx.closePath();
  
  // Disegna il nome del giocatore
  ctx.font = '14px Arial';
  ctx.fillStyle = 'black';
  ctx.textAlign = 'center';
  ctx.fillText(player.name, player.x, player.y - player.size / 2 - 5);
  
  // Evidenzia il giocatore corrente
  if (player.id === playerId) {
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.size / 2 + 3, 0, Math.PI * 2);
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.closePath();
  }
}

// Funzione per disegnare un target
function drawTarget(target) {
  // Disegna il cerchio esterno
  ctx.beginPath();
  ctx.arc(target.x, target.y, target.radius, 0, Math.PI * 2);
  ctx.fillStyle = target.color;
  ctx.fill();
  
  // Disegna un cerchio interno
  ctx.beginPath();
  ctx.arc(target.x, target.y, target.radius * 0.7, 0, Math.PI * 2);
  ctx.fillStyle = 'white';
  ctx.fill();
  
  // Disegna il cerchio centrale
  ctx.beginPath();
  ctx.arc(target.x, target.y, target.radius * 0.4, 0, Math.PI * 2);
  ctx.fillStyle = 'red';
  ctx.fill();
  ctx.closePath();
}

// Funzione per mostrare l'effetto del click
function drawClickEffect(x, y) {
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.fill();
  ctx.closePath();
}

// Funzione per mostrare l'animazione dei punti
function showPointsAnimation(x, y, points, isCurrentPlayer) {
  // Crea un elemento div per l'animazione dei punti
  const pointsElement = document.createElement('div');
  pointsElement.className = 'points-animation';
  pointsElement.textContent = `+${points}`;
  pointsElement.style.left = `${x}px`;
  pointsElement.style.top = `${y - 30}px`;
  pointsElement.style.color = isCurrentPlayer ? '#00ff00' : '#ffffff';
  
  // Aggiungi l'elemento al container del gioco
  gameScreen.appendChild(pointsElement);
  
  // Rimuovi l'elemento dopo l'animazione
  setTimeout(() => {
    pointsElement.remove();
  }, 1000);
}

// Funzione per mostrare i risultati finali
function showGameResults(players) {
  // Crea un elemento div per i risultati
  const resultsElement = document.createElement('div');
  resultsElement.className = 'game-results';
  
  // Crea l'intestazione
  const header = document.createElement('h2');
  header.textContent = 'Partita Terminata!';
  resultsElement.appendChild(header);
  
  // Crea la tabella dei risultati
  const resultsList = document.createElement('div');
  resultsList.className = 'results-list';
  
  // Aggiungi ogni giocatore alla lista
  players.forEach((player, index) => {
    const playerResult = document.createElement('div');
    playerResult.className = 'player-result';
    playerResult.style.backgroundColor = player.color;
    
    // Aggiungi la posizione
    const position = document.createElement('span');
    position.className = 'position';
    position.textContent = `#${index + 1}`;
    playerResult.appendChild(position);
    
    // Aggiungi il nome
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = player.name;
    playerResult.appendChild(name);
    
    // Aggiungi il punteggio
    const score = document.createElement('span');
    score.className = 'score';
    score.textContent = player.score;
    playerResult.appendChild(score);
    
    // Evidenzia il giocatore corrente
    if (player.id === playerId) {
      playerResult.classList.add('current-player');
    }
    
    resultsList.appendChild(playerResult);
  });
  
  resultsElement.appendChild(resultsList);
  
  // Aggiungi il pulsante per tornare alla schermata principale
  const backButton = document.createElement('button');
  backButton.textContent = 'Torna al Menu';
  backButton.addEventListener('click', () => {
    resultsElement.remove();
    gameScreen.style.display = 'none';
    welcomeScreen.style.display = 'block';
  });
  
  resultsElement.appendChild(backButton);
  
  // Aggiungi l'elemento al container del gioco
  gameScreen.appendChild(resultsElement);
}

// Funzione per disegnare il gioco
function draw() {
  // Pulisci il canvas
  ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  
  // Disegna tutti i target
  targets.forEach(target => {
    drawTarget(target);
  });
  
  // Disegna tutti i giocatori
  Object.values(players).forEach(player => {
    drawPlayer(player);
  });
  
  // Disegna il mirino del mouse se la partita è attiva
  if (gameActive) {
    drawCrosshair(mouseX, mouseY);
  }
  
  // Disegna il timer
  drawTimer();
  
  // Richiedi il prossimo frame
  requestAnimationFrame(draw);
}

// Funzione per disegnare il mirino
function drawCrosshair(x, y) {
  const size = 20;
  
  ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
  ctx.lineWidth = 2;
  
  // Linea orizzontale
  ctx.beginPath();
  ctx.moveTo(x - size, y);
  ctx.lineTo(x + size, y);
  ctx.stroke();
  
  // Linea verticale
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.lineTo(x, y + size);
  ctx.stroke();
  
  // Cerchio centrale
  ctx.beginPath();
  ctx.arc(x, y, 3, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
  ctx.fill();
}

// Funzione per disegnare il timer
function drawTimer() {
  ctx.font = 'bold 24px Arial';
  ctx.fillStyle = timeLeft <= 10 ? 'red' : 'white';
  ctx.textAlign = 'center';
  ctx.fillText(`Tempo: ${timeLeft}s`, GAME_WIDTH / 2, 30);
}

// Avvia il loop di disegno
draw();