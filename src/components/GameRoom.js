'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Card from './Card';

function getPlayerId() {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem('playerId');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('playerId', id);
  }
  return id;
}

export default function GameRoom({ roomId }) {
  const [state, setState] = useState(null);
  const [error, setError] = useState('');
  const [action, setAction] = useState(null);
  const [copied, setCopied] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const actionTimeout = useRef(null);
  const lastActionAt = useRef(null);
  const joined = useRef(false);
  const playerIdRef = useRef('');

  useEffect(() => {
    const playerId = getPlayerId();
    playerIdRef.current = playerId;
    const playerName = localStorage.getItem('playerName') || 'Anonymous';

    async function joinRoom() {
      try {
        const res = await fetch(`/api/rooms/${roomId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'join', playerId, playerName }),
        });
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        joined.current = true;
      } catch {
        setError('Failed to join room');
      }
    }

    async function poll() {
      if (!joined.current) return;
      try {
        const res = await fetch(`/api/rooms/${roomId}?playerId=${playerId}`);
        if (!res.ok) return;
        const data = await res.json();
        setState(data);
        setError('');

        if (data.lastAction && data.lastAction.at !== lastActionAt.current) {
          lastActionAt.current = data.lastAction.at;
          setAction(data.lastAction);
          clearTimeout(actionTimeout.current);
          actionTimeout.current = setTimeout(() => setAction(null), 3000);
        }
      } catch {}
    }

    joinRoom().then(poll);
    const interval = setInterval(poll, 2000);

    return () => {
      clearInterval(interval);
      clearTimeout(actionTimeout.current);
    };
  }, [roomId]);

  const sendAction = useCallback(async (actionType) => {
    try {
      const res = await fetch(`/api/rooms/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: actionType, playerId: playerIdRef.current }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Action failed');
      }
    } catch {
      setError('Network error');
    }
  }, [roomId]);

  const copyLink = useCallback(() => {
    const url = `${window.location.origin}/room/${roomId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [roomId]);

  if (notFound) {
    return (
      <main className="game-loading">
        <p>Room not found. It may have expired.</p>
        <a href="/" className="btn btn-primary" style={{ marginTop: 16, textDecoration: 'none' }}>
          Back to Home
        </a>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="game-loading">
        <div className="loading-spinner" />
        <p>Joining room...</p>
      </main>
    );
  }

  const you = state.players.find((p) => p.isYou);
  const others = state.players.filter((p) => !p.isYou);

  return (
    <main className="game-room">
      <div className="game-bg" />

      <header className="game-header">
        <div className="game-header-left">
          <h1 className="game-title">Bluff</h1>
          <div className="room-info">
            <span className="room-code">{roomId}</span>
            <button className="btn-copy" onClick={copyLink} title="Copy invite link">
              {copied ? '✓ Copied' : 'Copy Link'}
            </button>
          </div>
        </div>
        <div className="game-header-right">
          <span className="player-count">{state.playerCount} player{state.playerCount !== 1 ? 's' : ''}</span>
          <span className="deck-count">{state.deckCount} cards left</span>
        </div>
      </header>

      {action && (
        <div className={`action-toast ${action.type === 'cap' ? 'action-toast-cap' : ''}`}>
          {action.type === 'shuffle'
            ? `${action.by} shuffled the deck`
            : action.type === 'cap'
            ? `${action.by} called Cap — all cards revealed!`
            : `${action.by} dealt the cards`}
        </div>
      )}

      {error && <div className="error-toast">{error}</div>}

      <div className="table-area">
        <div className="table-center">
          <div className="deck-visual">
            <div className="deck-stack">
              <div className="deck-card deck-card-3" />
              <div className="deck-card deck-card-2" />
              <div className="deck-card deck-card-1" />
            </div>
            <span className="deck-label">{state.deckCount}</span>
          </div>

          <div className="table-actions">
            <button className="btn btn-action btn-shuffle" onClick={() => sendAction('shuffle')}>
              <span className="btn-icon">↻</span>
              Shuffle
            </button>
            <button className="btn btn-action btn-deal" onClick={() => sendAction('deal')}>
              <span className="btn-icon">⇥</span>
              Deal
            </button>
            <button
              className="btn btn-action btn-cap"
              onClick={() => sendAction('reveal')}
              disabled={!state.dealt || state.revealed}
            >
              <span className="btn-icon">👁</span>
              Cap
            </button>
          </div>
        </div>

        {others.length > 0 && (
          <div className="others-area">
            {others.map((player) => (
              <div key={player.id} className="other-player">
                <div className="other-player-name">{player.name}</div>
                <div className={`other-player-cards ${state.revealed ? 'other-player-cards-revealed' : ''}`}>
                  {state.revealed && player.hand
                    ? player.hand.map((card, i) => (
                        <Card key={card.id} card={card} index={i} />
                      ))
                    : Array.from({ length: player.cardCount }).map((_, i) => (
                        <Card key={i} card={{}} index={i} faceDown={true} />
                      ))}
                  {player.cardCount === 0 && (
                    <span className="no-cards">No cards</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {you && (
        <div className="your-hand-area">
          <div className="your-hand-label">
            <span className="your-hand-name">{you.name}</span>
            <span className="your-hand-badge">Your Hand</span>
          </div>
          <div className="your-hand-cards">
            {state.myHand.map((card, i) => (
              <Card key={card.id} card={card} index={i} />
            ))}
            {state.myHand.length === 0 && (
              <div className="no-cards-msg">
                <p>No cards yet — press <strong>Deal</strong> to start</p>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
