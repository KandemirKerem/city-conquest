import React, { useEffect } from 'react';
import { useGameStore } from './store/useGameStore';
import LobbyScreen from './components/LobbyScreen';
import TableScene3D from './components/TableScene3D';
import PaperMap2D from './components/PaperMap2D';
import GameHUD from './components/GameHUD';
import RpsBattleModal from './components/RpsBattleModal';

export default function App() {
  const initSocketListeners = useGameStore((s) => s.initSocketListeners);
  const room = useGameStore((s) => s.room);
  const viewMode = useGameStore((s) => s.viewMode);

  useEffect(() => {
    initSocketListeners();
  }, [initSocketListeners]);

  if (!room || room.phase === 'LOBBY') {
    return <LobbyScreen />;
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950">
      {/* Main Game Viewport: 3D CK3 Table Scene OR 2D Interactive Paper Map */}
      {viewMode === '3D' ? <TableScene3D /> : <PaperMap2D />}

      {/* Overlay HUD */}
      <GameHUD />

      {/* Rock-Paper-Scissors Live Duel Modal */}
      <RpsBattleModal />
    </div>
  );
}
