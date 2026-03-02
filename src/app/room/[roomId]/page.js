'use client';

import { useParams } from 'next/navigation';
import GameRoom from '@/components/GameRoom';

export default function RoomPage() {
  const { roomId } = useParams();
  return <GameRoom roomId={roomId} />;
}
