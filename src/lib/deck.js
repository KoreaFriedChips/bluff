const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const value of VALUES) {
      deck.push({ suit, value, id: `${value}_${suit}` });
    }
  }
  deck.push({ suit: 'joker', value: 'Red', id: 'joker_red' });
  deck.push({ suit: 'joker', value: 'Black', id: 'joker_black' });
  return deck;
}

export function createDeckWithCommunityJoker() {
  const deck = createDeck();
  deck.push({ suit: 'joker', value: 'Com', id: 'joker_community', community: true });
  return deck;
}

export function shuffle(deck) {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function deal(deck, playerCount, cardsPerPlayer = 5) {
  const counts = Array.isArray(cardsPerPlayer) ? cardsPerPlayer : Array(playerCount).fill(cardsPerPlayer);
  const total = counts.reduce((a, b) => a + b, 0);
  if (total > deck.length) {
    return null;
  }
  const hands = {};
  const remaining = [...deck];
  for (let p = 0; p < playerCount; p++) {
    hands[p] = remaining.splice(0, counts[p]);
  }
  return { hands, remaining };
}
