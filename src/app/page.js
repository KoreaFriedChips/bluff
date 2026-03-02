'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!playerName.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/create-room');
      const { roomId } = await res.json();
      localStorage.setItem('playerName', playerName.trim());
      router.push(`/room/${roomId}`);
    } catch {
      setLoading(false);
    }
  }

  function handleJoin() {
    if (!joinCode.trim() || !playerName.trim()) return;
    localStorage.setItem('playerName', playerName.trim());
    router.push(`/room/${joinCode.trim()}`);
  }

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
          <p className="logo-subtitle">Deal cards with friends, in real time</p>
        </div>

        <div className="landing-card">
          <div className="input-group">
            <label htmlFor="name">Your Name</label>
            <input
              id="name"
              type="text"
              placeholder="Enter your name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              maxLength={20}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </div>

          <button
            className="btn btn-primary"
            onClick={handleCreate}
            disabled={loading || !playerName.trim()}
          >
            {loading ? 'Creating...' : 'Create Room'}
          </button>

          <div className="divider">
            <span>or join an existing room</span>
          </div>

          <div className="input-group">
            <label htmlFor="code">Room Code</label>
            <input
              id="code"
              type="text"
              placeholder="Paste room code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              maxLength={8}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            />
          </div>

          <button
            className="btn btn-secondary"
            onClick={handleJoin}
            disabled={!joinCode.trim() || !playerName.trim()}
          >
            Join Room
          </button>
        </div>
      </div>
    </main>
  );
}
