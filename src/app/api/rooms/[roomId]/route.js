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

  const players = [];
  for (const [pid, player] of Object.entries(room.players)) {
    const entry = {
      id: pid,
      name: player.name,
      cardCount: room.hands[pid] ? room.hands[pid].length : 0,
      isYou: pid === playerId,
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
    deckCount: room.deck.length,
    playerCount: Object.keys(room.players).length,
    lastAction: room.lastAction,
  });
}

export async function POST(request, { params }) {
  const { roomId } = params;
  const body = await request.json();
  const { action, playerId, playerName } = body;

  const room = await getRoom(roomId);
  if (!room) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  }

  switch (action) {
    case 'join': {
      if (Object.keys(room.players).length >= 10 && !room.players[playerId]) {
        return NextResponse.json({ error: 'Room is full (max 10 players)' }, { status: 400 });
      }
      if (!room.players[playerId]) {
        room.players[playerId] = { name: playerName || `Player ${Object.keys(room.players).length + 1}` };
        room.playerOrder.push(playerId);
        if (room.dealt) {
          room.hands[playerId] = [];
        }
      }
      break;
    }
    case 'shuffle': {
      room.deck = shuffle(createDeck());
      room.hands = {};
      room.dealt = false;
      room.revealed = false;
      room.lastAction = { type: 'shuffle', by: room.players[playerId]?.name, at: Date.now() };
      break;
    }
    case 'deal': {
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
      room.lastAction = { type: 'deal', by: room.players[playerId]?.name, at: Date.now() };
      break;
    }
    case 'reveal': {
      if (!room.dealt) break;
      room.revealed = true;
      room.lastAction = { type: 'cap', by: room.players[playerId]?.name, at: Date.now() };
      break;
    }
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }

  await setRoom(roomId, room);
  return NextResponse.json({ ok: true });
}
