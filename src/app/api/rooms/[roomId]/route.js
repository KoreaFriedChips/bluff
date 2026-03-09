import { NextResponse } from 'next/server';
import { createDeck, shuffle, deal } from '@/lib/deck';
import { getRoom, setRoom } from '@/lib/store';

export async function GET(request, { params }) {
  const { roomId } = params;
  const { searchParams } = new URL(request.url);
  const playerId = searchParams.get('playerId');

  const room = await getRoom(roomId);
  if (!room) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  }

  if (room.kicked && room.kicked.includes(playerId)) {
    return NextResponse.json({ error: 'You were kicked from this room' }, { status: 403 });
  }

  const players = [];
  for (const [pid, player] of Object.entries(room.players)) {
    const entry = {
      id: pid,
      name: player.name,
      cardCount: room.hands[pid] ? room.hands[pid].length : 0,
      isYou: pid === playerId,
      isHost: pid === room.hostId,
    };
    if (room.revealed && room.hands[pid]) {
      entry.hand = room.hands[pid];
    }
    players.push(entry);
  }

  return NextResponse.json({
    roomId: room.id,
    players,
    myHand: room.hands[playerId] || [],
    dealt: room.dealt,
    revealed: room.revealed,
    isHost: playerId === room.hostId,
    deckCount: room.deck.length,
    playerCount: Object.keys(room.players).length,
    lastAction: room.lastAction,
    history: room.history || [],
  });
}

export async function POST(request, { params }) {
  const { roomId } = params;
  const body = await request.json();
  const { action, playerId, playerName, targetId } = body;

  const room = await getRoom(roomId);
  if (!room) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  }

  if (!room.kicked) room.kicked = [];
  if (!room.history) room.history = [];

  const now = Date.now();
  const byName = () => room.players[playerId]?.name || 'Unknown';

  switch (action) {
    case 'join': {
      if (room.kicked.includes(playerId)) {
        return NextResponse.json({ error: 'You were kicked from this room' }, { status: 403 });
      }
      if (Object.keys(room.players).length >= 10 && !room.players[playerId]) {
        return NextResponse.json({ error: 'Room is full (max 10 players)' }, { status: 400 });
      }
      if (!room.players[playerId]) {
        const name = playerName || `Player ${Object.keys(room.players).length + 1}`;
        room.players[playerId] = { name };
        room.playerOrder.push(playerId);
        if (room.dealt) {
          room.hands[playerId] = [];
        }
        room.history.push({ type: 'join', by: name, at: now });
      }
      if (!room.hostId) {
        room.hostId = playerId;
      }
      break;
    }
    case 'kick': {
      if (playerId !== room.hostId) {
        return NextResponse.json({ error: 'Only the host can kick players' }, { status: 403 });
      }
      if (!targetId || !room.players[targetId]) {
        return NextResponse.json({ error: 'Player not found' }, { status: 400 });
      }
      if (targetId === room.hostId) {
        return NextResponse.json({ error: 'Cannot kick yourself' }, { status: 400 });
      }
      const kickedName = room.players[targetId].name;
      delete room.players[targetId];
      delete room.hands[targetId];
      room.playerOrder = room.playerOrder.filter((id) => id !== targetId);
      room.kicked.push(targetId);
      room.lastAction = { type: 'kick', by: byName(), target: kickedName, at: now };
      room.history.push({ type: 'kick', by: byName(), target: kickedName, at: now });
      break;
    }
    case 'shuffle': {
      if (playerId !== room.hostId) {
        return NextResponse.json({ error: 'Only the host can shuffle' }, { status: 403 });
      }
      room.deck = shuffle(createDeck());
      room.hands = {};
      room.dealt = false;
      room.revealed = false;
      room.lastAction = { type: 'shuffle', by: byName(), at: now };
      room.history.push({ type: 'shuffle', by: byName(), at: now });
      break;
    }
    case 'deal': {
      if (playerId !== room.hostId) {
        return NextResponse.json({ error: 'Only the host can deal' }, { status: 403 });
      }
      const playerIds = Object.keys(room.players);
      const count = playerIds.length;
      if (count === 0) break;
      if (count * 5 > 54) {
        return NextResponse.json({ error: 'Too many players to deal 5 cards each' }, { status: 400 });
      }
      room.deck = shuffle(createDeck());
      const result = deal(room.deck, count, 5);
      if (!result) {
        return NextResponse.json({ error: 'Not enough cards' }, { status: 400 });
      }
      room.hands = {};
      playerIds.forEach((pid, idx) => {
        room.hands[pid] = result.hands[idx];
      });
      room.deck = result.remaining;
      room.dealt = true;
      room.revealed = false;
      room.lastAction = { type: 'deal', by: byName(), at: now };
      room.history.push({ type: 'deal', by: byName(), at: now });
      break;
    }
    case 'add-card': {
      if (playerId !== room.hostId) {
        return NextResponse.json({ error: 'Only the host can add cards' }, { status: 403 });
      }
      if (!room.dealt) {
        return NextResponse.json({ error: 'Cards have not been dealt yet' }, { status: 400 });
      }
      if (!targetId || !room.players[targetId]) {
        return NextResponse.json({ error: 'Player not found' }, { status: 400 });
      }
      if (room.deck.length === 0) {
        return NextResponse.json({ error: 'No cards left in the deck' }, { status: 400 });
      }
      const card = room.deck.shift();
      if (!room.hands[targetId]) room.hands[targetId] = [];
      room.hands[targetId].push(card);
      const targetName = room.players[targetId].name;
      room.lastAction = { type: 'add-card', by: byName(), target: targetName, at: now };
      room.history.push({ type: 'add-card', by: byName(), target: targetName, at: now });
      break;
    }
    case 'reveal': {
      if (!room.dealt) break;
      room.revealed = true;
      const revealedHands = {};
      for (const [pid, player] of Object.entries(room.players)) {
        if (room.hands[pid] && room.hands[pid].length > 0) {
          revealedHands[player.name] = room.hands[pid];
        }
      }
      room.lastAction = { type: 'cap', by: byName(), at: now };
      room.history.push({ type: 'cap', by: byName(), hands: revealedHands, at: now });
      break;
    }
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }

  await setRoom(roomId, room);
  return NextResponse.json({ ok: true });
}
