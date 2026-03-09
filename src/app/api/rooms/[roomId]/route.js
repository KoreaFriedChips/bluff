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
      dealCount: player.dealCount || 5,
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
      const perPlayer = playerIds.map((pid) => room.players[pid].dealCount || 5);
      const totalNeeded = perPlayer.reduce((a, b) => a + b, 0);
      if (totalNeeded > 54) {
        return NextResponse.json({ error: `Need ${totalNeeded} cards but deck only has 54` }, { status: 400 });
      }
      room.deck = shuffle(createDeck());
      const result = deal(room.deck, count, perPlayer);
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
      if (!targetId || !room.players[targetId]) {
        return NextResponse.json({ error: 'Player not found' }, { status: 400 });
      }
      const current = room.players[targetId].dealCount || 5;
      const otherTotal = Object.entries(room.players)
        .filter(([pid]) => pid !== targetId)
        .reduce((sum, [, p]) => sum + (p.dealCount || 5), 0);
      if (current + 1 + otherTotal > 54) {
        return NextResponse.json({ error: 'Not enough cards in the deck' }, { status: 400 });
      }
      room.players[targetId].dealCount = current + 1;
      const targetName = room.players[targetId].name;
      room.lastAction = { type: 'add-card', by: byName(), target: targetName, count: current + 1, at: now };
      room.history.push({ type: 'add-card', by: byName(), target: targetName, count: current + 1, at: now });
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
