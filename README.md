# Caccia alle Palline - Minigioco Multiplayer

Un semplice gioco multiplayer basato su browser dove i giocatori devono raccogliere palline colorate per guadagnare punti.

## Descrizione

In questo gioco, ogni giocatore controlla un cerchio colorato che si muove seguendo il cursore del mouse. L'obiettivo è raccogliere quante più palline possibili per aumentare il proprio punteggio. Quando un giocatore tocca una pallina, questa scompare e ne appare una nuova in una posizione casuale.

## Caratteristiche

- Gioco multiplayer in tempo reale
- Controllo semplice con il mouse
- Tabella dei punteggi aggiornata in tempo reale
- Colori casuali per giocatori e palline
- Interfaccia responsive

## Requisiti

- Node.js (versione 12 o superiore)
- npm (incluso con Node.js)

## Installazione

1. Clona o scarica questo repository
2. Apri un terminale nella cartella del progetto
3. Installa le dipendenze con il comando:

```
npm install
```

## Avvio del gioco

1. Avvia il server con il comando:

```
npm start
```

2. Apri il browser e vai all'indirizzo: `http://localhost:3000`
3. Inserisci il tuo nome e clicca su "Inizia a giocare"
4. Condividi l'indirizzo IP del tuo server con amici e familiari per giocare insieme

## Come giocare

- Muovi il mouse per controllare il tuo giocatore
- Raccogli le palline colorate toccandole con il tuo cerchio
- Guarda la tabella dei punteggi per vedere chi sta vincendo

## Tecnologie utilizzate

- Node.js
- Express
- Socket.io
- HTML5 Canvas

## Personalizzazione

Puoi modificare le impostazioni del gioco nel file `server.js`:

- `GAME_WIDTH` e `GAME_HEIGHT`: dimensioni dell'area di gioco
- `BALL_RADIUS`: dimensione delle palline
- `PLAYER_SIZE`: dimensione dei giocatori
- `BALL_SPEED`: velocità delle palline

## Utilizzo su VPS

Per rendere il gioco accessibile da Internet su un VPS:

1. Assicurati che la porta 3000 sia aperta nel firewall del tuo VPS
2. Avvia il server come descritto sopra
3. Condividi l'indirizzo IP pubblico del tuo VPS con gli amici
4. Gli amici possono connettersi visitando `http://[IP-del-tuo-VPS]:3000`

## Licenza

MIT