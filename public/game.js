// Connessione al server Socket.io
let socket;

try {
  socket = io();
  console.log('Socket.io connesso con successo');
} catch (error) {
  console.error('Errore nella connessione Socket.io:', error);
  alert('Errore di connessione al server. Ricarica la pagina e riprova.');
}

// Aggiungi un gestore di errori globale
window.onerror = function(message, source, lineno, colno, error) {
  console.error('Errore JavaScript:', message, 'in', source, 'linea', lineno, ':', error);
  return false;
};

// Aggiungi gestori di eventi per debug
document.addEventListener('click', function(e) {
  console.log('Documento: evento click rilevato su', e.target.tagName, e.target.id || e.target.className);
});

document.addEventListener('touchstart', function(e) {
  console.log('Documento: evento touchstart rilevato su', e.target.tagName, e.target.id || e.target.className);
});

document.addEventListener('touchend', function(e) {
  console.log('Documento: evento touchend rilevato su', e.target.tagName, e.target.id || e.target.className);
});

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

// Funzione per gestire il movimento del mouse/touch
function handlePointerMove(x, y) {
  const rect = canvas.getBoundingClientRect();
  mouseX = x - rect.left;
  mouseY = y - rect.top;
  
  // Invia la posizione al server
  if (playerId && gameActive) {
    socket.emit('playerMove', { x: mouseX, y: mouseY });
  }
}

// Funzione per gestire il click del mouse/touch
function handlePointerClick(x, y) {
  if (!playerId || !gameActive) return;
  
  const rect = canvas.getBoundingClientRect();
  const clickX = x - rect.left;
  const clickY = y - rect.top;
  
  // Invia la posizione del click al server
  socket.emit('playerClick', { x: clickX, y: clickY });
  
  // Effetto visivo del click
  drawClickEffect(clickX, clickY);
}

// Gestione degli eventi del mouse
canvas.addEventListener('mousemove', (event) => {
  console.log('Canvas: mousemove');
  handlePointerMove(event.clientX, event.clientY);
});

canvas.addEventListener('click', (event) => {
  console.log('Canvas: click');
  handlePointerClick(event.clientX, event.clientY);
});

// Gestione degli eventi touch per dispositivi mobili
canvas.addEventListener('touchmove', (event) => {
  console.log('Canvas: touchmove');
  event.preventDefault(); // Previene lo scrolling della pagina
  if (event.touches.length > 0) {
    const touch = event.touches[0];
    handlePointerMove(touch.clientX, touch.clientY);
  }
});

canvas.addEventListener('touchend', (event) => {
  console.log('Canvas: touchend');
  event.preventDefault(); // Previene il comportamento predefinito
  if (event.changedTouches.length > 0) {
    const touch = event.changedTouches[0];
    handlePointerClick(touch.clientX, touch.clientY);
  }
});

// Aggiungi touchstart per migliorare la reattività
canvas.addEventListener('touchstart', (event) => {
  console.log('Canvas: touchstart');
  event.preventDefault(); // Previene il comportamento predefinito
});

// Funzione per gestire la selezione della modalità di gioco
function selectGameMode(button) {
  // Ignora i pulsanti disabilitati
  if (button.classList.contains('disabled')) return;
  
  // Rimuovi la classe 'active' da tutti i pulsanti
  modeButtons.forEach(btn => btn.classList.remove('active'));
  
  // Aggiungi la classe 'active' al pulsante cliccato
  button.classList.add('active');
  
  // Imposta la modalità selezionata
  selectedGameMode = button.getAttribute('data-mode');
}

// Gestione dei pulsanti di selezione modalità
modeButtons.forEach(button => {
  if (!button.classList.contains('disabled')) {
    // Usa entrambi gli eventi per garantire la compatibilità
    button.addEventListener('click', function() {
      console.log('Pulsante modalità: click', this.dataset.mode);
      selectGameMode(this);
    });
    
    button.addEventListener('touchend', function(e) {
      e.preventDefault();
      console.log('Pulsante modalità: touchend', this.dataset.mode);
      selectGameMode(this);
    });
  }
});

// Funzione per gestire l'inizio del matchmaking
function startMatchmaking() {
  console.log('Pulsante Cerca partita cliccato');
  
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
}

// Aggiungi event listener per il pulsante "Cerca partita"
// Usa entrambi gli eventi per garantire la compatibilità
startButton.addEventListener('click', function(e) {
  console.log('Pulsante Cerca partita: click');
  startMatchmaking();
});

startButton.addEventListener('touchend', function(e) {
  e.preventDefault();
  console.log('Pulsante Cerca partita: touchend');
  startMatchmaking();
});

// Aggiungi touchstart per migliorare la reattività
startButton.addEventListener('touchstart', function(e) {
  e.preventDefault();
  console.log('Pulsante Cerca partita: touchstart');
});

// Funzione per gestire l'annullamento del matchmaking
function cancelMatchmaking() {
  // Annulla la ricerca
  socket.emit('cancelQueue');
  
  // Torna alla schermata di benvenuto
  matchmakingScreen.style.display = 'none';
  welcomeScreen.style.display = 'block';
}

// Gestione del pulsante di annullamento matchmaking
// Usa entrambi gli eventi per garantire la compatibilità
cancelButton.addEventListener('click', function() {
  console.log('Pulsante Annulla: click');
  cancelMatchmaking();
});

cancelButton.addEventListener('touchend', function(e) {
  e.preventDefault();
  console.log('Pulsante Annulla: touchend');
  cancelMatchmaking();
});

// Aggiungi touchstart per migliorare la reattività
cancelButton.addEventListener('touchstart', function(e) {
  e.preventDefault();
  console.log('Pulsante Annulla: touchstart');
});

// Permetti di iniziare anche premendo Invio
playerNameInput.addEventListener('keypress', (event) => {
  if (event.key === 'Enter') {
    startButton.click();
  }
});

// Migliora l'esperienza su dispositivi mobili per l'input del nome
playerNameInput.addEventListener('focus', function() {
  // Scorrere la pagina per assicurarsi che l'input sia visibile quando la tastiera appare
  setTimeout(function() {
    playerNameInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 300);
});

// Quando l'utente tocca fuori dall'input, chiudi la tastiera
document.addEventListener('touchend', function(e) {
  if (e.target !== playerNameInput && document.activeElement === playerNameInput) {
    playerNameInput.blur();
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
  
  // Mostra i risultati finali solo se la partita è terminata
  if (results && results.players) {
    showGameResults(results.players);
  }
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
  // Rimuovi eventuali risultati precedenti
  const existingResults = document.querySelector('.game-results');
  if (existingResults) {
    existingResults.remove();
  }
  
  // Crea un elemento div per i risultati
  const resultsElement = document.createElement('div');
  resultsElement.className = 'game-results';
  resultsElement.id = 'game-results';
  
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
  backButton.id = 'back-to-menu';
  
  // Funzione per tornare al menu principale
  function backToMainMenu() {
    console.log('Pulsante Torna al Menu cliccato');
    resultsElement.remove();
    gameScreen.style.display = 'none';
    welcomeScreen.style.display = 'block';
    
    // Resetta lo stato del gioco
    gameActive = false;
    playerId = null;
    players = {};
    targets = [];
  }
  
  // Gestione del pulsante Torna al Menu
  backButton.addEventListener('click', function() {
    console.log('Pulsante Torna al Menu: click');
    backToMainMenu();
  });
  
  backButton.addEventListener('touchend', function(e) {
    e.preventDefault();
    console.log('Pulsante Torna al Menu: touchend');
    backToMainMenu();
  });
  
  backButton.addEventListener('touchstart', function(e) {
    e.preventDefault();
    console.log('Pulsante Torna al Menu: touchstart');
  });
  
  resultsElement.appendChild(backButton);
  
  // Aggiungi l'elemento al container del gioco
  gameScreen.appendChild(resultsElement);
}

// Funzione per disegnare i nomi dei giocatori in una posizione fissa
function drawPlayerNames() {
  // Crea un'area per i nomi dei giocatori sopra il canvas
  const playerNameArea = document.getElementById('player-names-area');
  if (!playerNameArea) {
    // Crea l'area se non esiste
    const newPlayerNameArea = document.createElement('div');
    newPlayerNameArea.id = 'player-names-area';
    newPlayerNameArea.style.display = 'flex';
    newPlayerNameArea.style.justifyContent = 'space-around';
    newPlayerNameArea.style.marginBottom = '10px';
    newPlayerNameArea.style.padding = '5px';
    newPlayerNameArea.style.backgroundColor = 'rgba(255, 255, 255, 0.7)';
    newPlayerNameArea.style.borderRadius = '5px';
    
    // Inserisci l'area prima del canvas
    canvas.parentNode.insertBefore(newPlayerNameArea, canvas);
  }
  
  // Aggiorna l'area dei nomi
  const playerNameArea = document.getElementById('player-names-area');
  playerNameArea.innerHTML = '';
  
  // Aggiungi i nomi dei giocatori
  Object.values(players).forEach(player => {
    const nameElement = document.createElement('div');
    nameElement.style.color = player.color;
    nameElement.style.fontWeight = 'bold';
    nameElement.style.padding = '5px';
    nameElement.style.border = player.id === playerId ? '2px solid black' : 'none';
    nameElement.style.borderRadius = '3px';
    nameElement.textContent = player.name;
    playerNameArea.appendChild(nameElement);
  });
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
  
  // Disegna i nomi dei giocatori in una posizione fissa
  drawPlayerNames();
  
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