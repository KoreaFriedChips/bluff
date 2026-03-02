'use client';

import Card from './Card';

export default function PlayerHand({ cards, playerName, isYou }) {
  return (
    <div className={`player-hand ${isYou ? 'player-hand-you' : 'player-hand-other'}`}>
      <div className="player-label">
        <span className="player-name">{playerName}</span>
        {isYou && <span className="player-badge">You</span>}
      </div>
      <div className="hand-cards">
        {cards.map((card, i) => (
          <Card key={card.id || i} card={card} index={i} faceDown={!isYou} />
        ))}
      </div>
    </div>
  );
}
