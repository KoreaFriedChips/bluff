'use client';

const SUIT_SYMBOLS = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
  joker: '★',
};

const SUIT_COLORS = {
  hearts: '#c0392b',
  diamonds: '#c0392b',
  clubs: '#1a1a2e',
  spades: '#1a1a2e',
  joker: '#c9a96e',
};

export default function Card({ card, index = 0, faceDown = false }) {
  if (faceDown) {
    return (
      <div className="card card-back" style={{ animationDelay: `${index * 0.08}s` }}>
        <div className="card-back-pattern">
          <div className="card-back-inner">
            <span className="card-back-logo">B</span>
          </div>
        </div>
      </div>
    );
  }

  const isJoker = card.suit === 'joker';
  const color = SUIT_COLORS[card.suit];
  const symbol = SUIT_SYMBOLS[card.suit];

  return (
    <div
      className={`card card-face ${card.suit}`}
      style={{ animationDelay: `${index * 0.08}s`, '--card-color': color }}
    >
      <div className="card-corner card-corner-top">
        <span className="card-value">{card.value}</span>
        <span className="card-suit-small">{symbol}</span>
      </div>

      <div className="card-center">
        {isJoker ? (
          <div className="joker-face">
            <span className="joker-symbol">🃏</span>
            <span className="joker-label">{card.value}</span>
          </div>
        ) : (
          <span className="card-suit-large">{symbol}</span>
        )}
      </div>

      <div className="card-corner card-corner-bottom">
        <span className="card-value">{card.value}</span>
        <span className="card-suit-small">{symbol}</span>
      </div>
    </div>
  );
}
