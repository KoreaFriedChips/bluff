import { NextResponse } from 'next/server';
import { createDeck, shuffle } from '@/lib/deck';
import { setRoom } from '@/lib/store';

export async function GET() {
  const roomId = Math.random().toString(36).slice(2, 10);
  const room = {
    id: roomId,
    deck: shuffle(createDeck()),
    players: {},
    hands: {},
    playerOrder: [],
    hostId: null,
    kicked: [],
    dealt: false,
    revealed: false,
    lastAction: null,
  };
  await setRoom(roomId, room);
  return NextResponse.json({ roomId });
}
