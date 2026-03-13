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
  const [shuffling, setShuffling] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [kicked, setKicked] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [needsName, setNeedsName] = useState(false);
  const [ready, setReady] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const actionTimeout = useRef(null);
  const lastActionAt = useRef(null);
  const joined = useRef(false);
  const playerIdRef = useRef('');

  useEffect(() => {
    const stored = localStorage.getItem('playerName');
    if (stored) {
      setReady(true);
    } else {
      setNeedsName(true);
    }
  }, []);

  function handleNameSubmit(e) {
    e.preventDefault();
    if (!nameInput.trim()) return;
    localStorage.setItem('playerName', nameInput.trim());
    setNeedsName(false);
    setReady(true);
  }

  useEffect(() => {
    if (!ready) return;

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
        if (res.status === 403) {
          setKicked(true);
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
        if (res.status === 403) {
          setKicked(true);
          joined.current = false;
          return;
        }
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
  }, [roomId, ready]);

  const sendAction = useCallback(async (actionType, extra = {}) => {
    try {
      const res = await fetch(`/api/rooms/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: actionType, playerId: playerIdRef.current, ...extra }),
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

  if (needsName) {
    return (
      <main className="landing">
        <div className="landing-bg" />
        <div className="landing-content">
          <div className="logo-area">
            <div className="suit-icons">
              <span className="suit-icon hearts">♥</span>
              <span className="suit-icon spades">♠</span>
              <span className="suit-icon diamonds">♦</span>
              <span className="suit-icon clubs">♣</span>
            </div>
            <h1 className="logo-title">Bluff</h1>
            <p className="logo-subtitle">You&apos;ve been invited to a game</p>
          </div>
          <form className="landing-card" onSubmit={handleNameSubmit}>
            <div className="input-group">
              <label htmlFor="join-name">Enter your name to join</label>
              <input
                id="join-name"
                type="text"
                placeholder="Your name"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                maxLength={20}
                autoFocus
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!nameInput.trim()}
            >
              Join Game
            </button>
          </form>
        </div>
      </main>
    );
  }

  if (kicked) {
    return (
      <main className="game-loading">
        <p className="kicked-msg">You were kicked from this room.</p>
        <a href="/" className="btn btn-primary" style={{ marginTop: 16, textDecoration: 'none' }}>
          Back to Home
        </a>
      </main>
    );
  }

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
          {state.isHost && (
            <button
              className={`btn-setting ${state.communityJokerEnabled ? 'btn-setting-active' : ''}`}
              onClick={() => sendAction('toggle-community-joker')}
              title={state.communityJokerEnabled ? 'Disable Community Joker' : 'Enable Community Joker'}
            >
              🃏 Community Joker {state.communityJokerEnabled ? 'ON' : 'OFF'}
            </button>
          )}
          {!state.isHost && state.communityJokerEnabled && (
            <span className="setting-indicator">🃏 Community Joker</span>
          )}
          <span className="player-count">{state.playerCount} player{state.playerCount !== 1 ? 's' : ''}</span>
          <span className="deck-count">{state.deckCount} cards left</span>
        </div>
      </header>

      {action && (
        <div className={`action-toast ${action.type === 'cap' ? 'action-toast-cap' : ''} ${action.type === 'kick' ? 'action-toast-kick' : ''} ${action.type === 'spectate' ? 'action-toast-spectate' : ''} ${action.type === 'setting' ? 'action-toast-setting' : ''}`}>
          {action.type === 'shuffle'
            ? `${action.by} shuffled the deck`
            : action.type === 'cap'
            ? `${action.by} called Cap — all cards revealed!`
            : action.type === 'kick'
            ? `${action.by} kicked ${action.target}`
            : action.type === 'add-card'
            ? `${action.target} now gets ${action.count} cards per deal`
            : action.type === 'spectate'
            ? `${action.target} is now ${action.mode}`
            : action.type === 'setting'
            ? `${action.by} ${action.state} ${action.setting}`
            : `${action.by} dealt the cards`}
        </div>
      )}

      {error && <div className="error-toast">{error}</div>}

      <div className="table-area">
        <div className="table-center">
          <div className="deck-visual">
            <div className={`deck-stack ${shuffling ? 'deck-shuffling' : ''}`}>
              <div className="deck-card deck-card-3" />
              <div className="deck-card deck-card-2" />
              <div className="deck-card deck-card-1" />
              {shuffling && (
                <>
                  <div className="deck-card shuffle-fan shuffle-fan-l" />
                  <div className="deck-card shuffle-fan shuffle-fan-r" />
                </>
              )}
            </div>
            <span className="deck-label">{state.deckCount}</span>
          </div>

          {state.communityJokerCard && (
            <div className="community-joker-area">
              <span className="community-joker-label">Community Joker</span>
              <div className="community-joker-card">
                <Card card={state.communityJokerCard} index={0} />
              </div>
            </div>
          )}

          <div className="table-actions">
            <button
              className="btn btn-action btn-shuffle"
              disabled={shuffling || !state.isHost}
              onClick={() => {
                setShuffling(true);
                setTimeout(() => {
                  sendAction('shuffle');
                  setShuffling(false);
                }, 900);
              }}
            >
              <span className={`btn-icon ${shuffling ? 'btn-icon-spin' : ''}`}>↻</span>
              {shuffling ? 'Shuffling...' : 'Shuffle'}
            </button>
            <button className="btn btn-action btn-deal" onClick={() => sendAction('deal')} disabled={!state.isHost}>
              <span className="btn-icon">⇥</span>
              Deal
            </button>
            <button
              className="btn btn-action btn-cap"
              onClick={() => sendAction('reveal')}
              disabled={!state.dealt || state.revealed || state.isSpectating}
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
                <div className="other-player-header">
                  <div className="other-player-name">
                    {player.name}
                    {player.isHost && <span className="host-badge">Host</span>}
                    {player.spectating && <span className="spectate-badge">Spectating</span>}
                    {state.isHost && !player.spectating && player.dealCount !== 5 && (
                      <span className="deal-count-badge">{player.dealCount} cards</span>
                    )}
                  </div>
                  {state.isHost && (
                    <div className="host-controls">
                      <button
                        className={`btn-spectate ${player.spectating ? 'btn-spectate-active' : ''}`}
                        onClick={() => sendAction('toggle-spectate', { targetId: player.id })}
                        title={player.spectating ? `Move ${player.name} back to playing` : `Move ${player.name} to spectate`}
                      >
                        👁
                      </button>
                      {!player.spectating && (
                        <button
                          className="btn-add-card"
                          onClick={() => sendAction('add-card', { targetId: player.id })}
                          title={`Increase ${player.name}'s deal count`}
                        >
                          +
                        </button>
                      )}
                      <button
                        className="btn-kick"
                        onClick={() => sendAction('kick', { targetId: player.id })}
                        title={`Kick ${player.name}`}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
                <div className={`other-player-cards ${(state.revealed || state.isSpectating) && player.hand ? 'other-player-cards-revealed' : ''}`}>
                  {player.spectating ? (
                    <span className="no-cards">Spectating</span>
                  ) : (state.revealed || state.isSpectating) && player.hand ? (
                    player.hand.map((card, i) => (
                      <Card key={card.id} card={card} index={i} />
                    ))
                  ) : (
                    <>
                      {Array.from({ length: player.cardCount }).map((_, i) => (
                        <Card key={i} card={{}} index={i} faceDown={true} />
                      ))}
                      {player.cardCount === 0 && (
                        <span className="no-cards">No cards</span>
                      )}
                    </>
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
            {state.isSpectating
              ? <span className="spectate-badge spectate-badge-you">Spectating</span>
              : <span className="your-hand-badge">Your Hand</span>
            }
            {state.isHost && <span className="host-badge host-badge-you">Host</span>}
            {state.isHost && !state.isSpectating && you.dealCount !== 5 && (
              <span className="deal-count-badge">{you.dealCount} cards</span>
            )}
            {state.isHost && !state.isSpectating && (
              <button
                className="btn-add-card btn-add-card-you"
                onClick={() => sendAction('add-card', { targetId: you.id })}
                title="Increase your deal count"
              >
                + Card
              </button>
            )}
          </div>
          <div className="your-hand-cards">
            {state.isSpectating ? (
              <div className="no-cards-msg">
                <p>You are spectating — you can see all players' cards</p>
              </div>
            ) : (
              <>
                {state.myHand.map((card, i) => (
                  <Card key={card.id} card={card} index={i} />
                ))}
                {state.myHand.length === 0 && (
                  <div className="no-cards-msg">
                    <p>No cards yet — press <strong>Deal</strong> to start</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
      {state.history && state.history.length > 0 && (
        <div className={`history-panel ${logOpen ? 'history-panel-open' : ''}`}>
          <button className="history-toggle" onClick={() => setLogOpen((o) => !o)}>
            <span className="history-toggle-icon">{logOpen ? '▾' : '▸'}</span>
            Game Log
            <span className="history-count">{state.history.length}</span>
          </button>
          {logOpen && (
            <div className="history-list">
              {[...state.history].reverse().map((entry, i) => (
                <div key={i} className={`history-entry ${entry.type === 'cap' && entry.hands ? 'history-entry-cap' : ''}`}>
                  <span className="history-time">
                    {new Date(entry.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                  <span className={`history-icon history-icon-${entry.type}`}>
                    {entry.type === 'join' ? '→' : entry.type === 'shuffle' ? '↻' : entry.type === 'deal' ? '⇥' : entry.type === 'cap' ? '👁' : entry.type === 'kick' ? '✕' : entry.type === 'add-card' ? '+' : entry.type === 'spectate' ? '👁' : entry.type === 'setting' ? '⚙' : entry.type === 'community-joker' ? '🃏' : '•'}
                  </span>
                  <div className="history-text">
                    {entry.type === 'join' && <><strong>{entry.by}</strong> joined the room</>}
                    {entry.type === 'shuffle' && <><strong>{entry.by}</strong> shuffled the deck</>}
                    {entry.type === 'deal' && <><strong>{entry.by}</strong> dealt cards</>}
                    {entry.type === 'cap' && (
                      <>
                        <div><strong>{entry.by}</strong> called Cap</div>
                        {entry.hands && (
                          <div className="history-hands">
                            {Object.entries(entry.hands).map(([name, cards]) => (
                              <div key={name} className="history-hand-row">
                                <span className="history-hand-name">{name}</span>
                                <span className="history-hand-cards">
                                  {cards.map((c) => {
                                    const sym = c.suit === 'hearts' ? '♥' : c.suit === 'diamonds' ? '♦' : c.suit === 'clubs' ? '♣' : c.suit === 'spades' ? '♠' : '★';
                                    const color = c.suit === 'hearts' || c.suit === 'diamonds' ? 'red' : c.suit === 'joker' ? 'gold' : 'dark';
                                    return (
                                      <span key={c.id} className={`history-card history-card-${color}`}>
                                        {c.value}{sym}
                                      </span>
                                    );
                                  })}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                    {entry.type === 'add-card' && <><strong>{entry.target}</strong> now gets <strong>{entry.count}</strong> cards per deal</>}
                    {entry.type === 'kick' && <><strong>{entry.by}</strong> kicked <strong>{entry.target}</strong></>}
                    {entry.type === 'spectate' && <><strong>{entry.target}</strong> is now <strong>{entry.mode}</strong></>}
                    {entry.type === 'setting' && <><strong>{entry.by}</strong> {entry.state} <strong>{entry.setting}</strong></>}
                    {entry.type === 'community-joker' && <><strong>{entry.by}</strong> drew the Community Joker — placed in the middle</>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
