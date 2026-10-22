import React, { useEffect, useState } from 'react';
import { useGameStore } from '../store/useGameStore';

export default function GameHUD() {
  const room = useGameStore((s) => s.room);
  const mySocketId = useGameStore((s) => s.mySocketId);
  const viewMode = useGameStore((s) => s.viewMode);
  const setViewMode = useGameStore((s) => s.setViewMode);
  const cameraZoom = useGameStore((s) => s.cameraZoom);
  const setCameraZoom = useGameStore((s) => s.setCameraZoom);
  const throwEraser = useGameStore((s) => s.throwEraser);
  const startAttack = useGameStore((s) => s.startAttack);
  const leaveRoom = useGameStore((s) => s.leaveRoom);
  const returnToLobby = useGameStore((s) => s.returnToLobby);
  const errorMsg = useGameStore((s) => s.errorMsg);

  const [turnSecs, setTurnSecs] = useState(30);
  const [showLogs, setShowLogs] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!room?.turnDeadline) return;
    const timer = setInterval(() => {
      const rem = Math.max(0, Math.ceil((room.turnDeadline - Date.now()) / 1000));
      setTurnSecs(rem);
    }, 250);
    return () => clearInterval(timer);
  }, [room?.turnDeadline]);

  if (!room) return null;

  const map = room.map;
  const activePlayer = room.players[room.currentTurnIndex];
  const mePlayer = room.players.find((p) => p.id === mySocketId);
  const isMyTurn = room.activePlayerId === mySocketId;
  const isHost = room.hostId === mySocketId;
  const isSpectating = !mePlayer || mePlayer.eliminated || mePlayer.isSpectator;

  const selectedSource =
    room.selectedSourceId !== null ? map.territories[room.selectedSourceId] : null;
  const selectedTarget =
    room.selectedTargetId !== null ? map.territories[room.selectedTargetId] : null;
  const targetOwner = selectedTarget?.owner
    ? room.players.find((p) => p.id === selectedTarget.owner)
    : null;

  const copyCode = () => {
    navigator.clipboard.writeText(room.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-30 flex flex-col justify-between p-2.5 sm:p-4">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Left: Room Code & Win Target */}
        <div className="pointer-events-auto flex items-center gap-2 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 px-3 py-1.5 rounded-2xl shadow-lg">
          <button
            onClick={copyCode}
            title="Oda kodunu kopyala"
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded-xl text-xs font-black text-amber-400 border border-amber-500/30 transition"
          >
            <span>ODA: {room.code}</span>
            <span className="text-[10px] text-slate-300">{copied ? '✓' : '📋'}</span>
          </button>

          <div className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-slate-300 px-2 border-l border-slate-700">
            <span>🎯 Kazanma Hedefi (%80):</span>
            <strong className="text-amber-400">
              {map.winTargetCount}/{map.totalTerritories} Toprak
            </strong>
          </div>
        </div>

        {/* Center: Active Turn Status Banner */}
        <div className="pointer-events-auto flex items-center gap-2.5 bg-slate-900/95 backdrop-blur-md border-2 border-slate-700 px-4 py-1.5 rounded-2xl shadow-xl">
          {room.phase === 'INITIAL_PICK' && (
            <span className="text-xs sm:text-sm font-extrabold text-amber-300">
              📍 Başlangıç Toprağı Seçimi — Sıra:{' '}
              <span style={{ color: activePlayer?.color }}>{activePlayer?.name}</span>
            </span>
          )}
          {room.phase === 'TURN_SELECT' && (
            <span className="text-xs sm:text-sm font-extrabold text-white">
              {isMyTurn ? (
                <span className="text-emerald-400">⚡ SIRA SENDE! Hamleni Seç</span>
              ) : (
                <>
                  Sıra:{' '}
                  <span style={{ color: activePlayer?.color }}>{activePlayer?.name}</span>
                </>
              )}
            </span>
          )}
          {room.phase === 'ERASER_TOSS' && (
            <span className="text-xs sm:text-sm font-extrabold text-amber-300 animate-pulse">
              🎲 {room.eraserToss?.playerName} Silgi Fırlatıyor...
            </span>
          )}
          {room.phase === 'RPS_BATTLE' && (
            <span className="text-xs sm:text-sm font-extrabold text-rose-400 animate-pulse">
              ⚔️ Taş - Kağıt - Makas Düellosu!
            </span>
          )}
          {(room.phase === 'INITIAL_PICK' || room.phase === 'TURN_SELECT') && (
            <span className="text-xs font-black bg-slate-800 text-amber-400 px-2 py-0.5 rounded-lg border border-slate-700">
              {turnSecs}s
            </span>
          )}
        </div>

        {/* Right: 3D/2D Mode Switcher, CK3 Camera Zoom & Leave */}
        <div className="pointer-events-auto flex items-center gap-2 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 px-3 py-1.5 rounded-2xl shadow-lg">
          <button
            onClick={() => setViewMode(viewMode === '3D' ? '2D' : '3D')}
            className="px-2.5 py-1 rounded-xl text-xs font-extrabold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition"
          >
            {viewMode === '3D' ? '📱 2D Kağıt Modu' : '🎲 3D Masa Modu (CK3)'}
          </button>

          {viewMode === '3D' && (
            <div className="hidden md:flex items-center gap-1.5 text-[11px] font-bold text-slate-300 px-2 border-l border-slate-700">
              <span>İzometrik</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.02"
                value={cameraZoom}
                onChange={(e) => setCameraZoom(parseFloat(e.target.value))}
                className="w-20 accent-amber-400 cursor-pointer"
                title="Scroll ile yakınlaştır (İzometrik) / uzaklaştır (CK3 Kuş Bakışı)"
              />
              <span>Kuş Bakışı</span>
            </div>
          )}

          <button
            onClick={leaveRoom}
            className="px-2.5 py-1 rounded-xl text-xs font-bold bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 transition"
          >
            Çıkış
          </button>
        </div>
      </div>

      {/* Error Toast */}
      {errorMsg && (
        <div className="pointer-events-auto self-center bg-rose-600/95 text-white font-bold text-xs sm:text-sm px-4 py-2 rounded-xl shadow-xl border border-rose-300 animate-bounce">
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Spectator Mode Banner */}
      {isSpectating && room.phase !== 'GAME_OVER' && (
        <div className="pointer-events-auto self-center bg-slate-900/90 border border-amber-500/40 text-amber-300 text-xs font-bold px-4 py-1.5 rounded-full shadow-lg">
          👁️ İZLEYİCİ MODUNDASIN — Maçı canlı olarak takip ediyorsun
        </div>
      )}

      {/* Middle Area: Player Cards (Left) & Logs (Right) */}
      <div className="flex-1 flex items-start justify-between my-2 overflow-hidden">
        {/* 4 Player Cards */}
        <div className="pointer-events-auto flex flex-col gap-2 w-44 sm:w-56">
          {room.players.map((p, idx) => {
            const isTurn = room.currentTurnIndex === idx && room.phase !== 'GAME_OVER';
            const isMe = p.id === mySocketId;
            const pct = Math.round((p.territoryCount / map.totalTerritories) * 100);

            return (
              <div
                key={p.id}
                className={`rounded-2xl p-2.5 border-2 backdrop-blur-md transition-all shadow-lg ${
                  p.eliminated
                    ? 'bg-slate-900/50 border-slate-800 opacity-55'
                    : isTurn
                    ? 'bg-slate-900/95 scale-[1.03] shadow-xl'
                    : 'bg-slate-900/80 border-slate-800'
                }`}
                style={{
                  borderColor: isTurn ? p.color : undefined,
                }}
              >
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0 border border-white"
                      style={{ backgroundColor: p.color }}
                    />
                    <span className="font-extrabold text-xs sm:text-sm text-white truncate">
                      {p.name} {isMe && '(Sen)'}
                    </span>
                  </div>
                  {isTurn && (
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 shrink-0">
                      SIRA
                    </span>
                  )}
                </div>

                <div className="mt-1.5 flex items-center justify-between text-[11px] font-bold text-slate-300">
                  {p.eliminated ? (
                    <span className="text-rose-400 font-extrabold">💀 ELENDİ (İzleyici 👁️)</span>
                  ) : (
                    <>
                      <span>{p.territoryCount} Toprak</span>
                      <span className="text-amber-300">%{pct}</span>
                    </>
                  )}
                </div>

                {/* Progress bar toward 80% win target */}
                {!p.eliminated && (
                  <div className="mt-1 w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, (p.territoryCount / map.winTargetCount) * 100)}%`,
                        backgroundColor: p.color,
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Right: Collapsible Live Logs */}
        <div className="pointer-events-auto hidden sm:flex flex-col items-end">
          <button
            onClick={() => setShowLogs(!showLogs)}
            className="bg-slate-900/90 border border-slate-700 text-slate-300 hover:text-white text-xs font-bold px-3 py-1 rounded-xl mb-1.5 shadow"
          >
            {showLogs ? '📜 Kayıtları Gizle' : '📜 Oyun Kaydı'}
          </button>

          {showLogs && (
            <div className="w-72 max-h-56 overflow-y-auto bg-slate-900/85 backdrop-blur-md border border-slate-800 rounded-2xl p-3 flex flex-col gap-1.5 shadow-xl text-xs">
              {room.logs
                .slice()
                .reverse()
                .map((log) => (
                  <div
                    key={log.id}
                    className={`leading-snug pb-1 border-b border-slate-800/60 last:border-none ${
                      log.type === 'win'
                        ? 'text-emerald-300 font-bold'
                        : log.type === 'lose' || log.type === 'eliminate'
                        ? 'text-rose-300 font-semibold'
                        : log.type === 'battle' || log.type === 'toss'
                        ? 'text-amber-300 font-semibold'
                        : 'text-slate-300'
                    }`}
                  >
                    {log.text}
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Action Bar for Active Turn */}
      <div className="pointer-events-auto self-center w-full max-w-2xl">
        {room.phase === 'INITIAL_PICK' && isMyTurn && (
          <div className="bg-slate-900/95 border-2 border-amber-400 rounded-2xl px-5 py-3 shadow-2xl text-center">
            <p className="text-sm sm:text-base font-black text-amber-300">
              👆 Başlangıç Üssünü Seç: Haritadaki herhangi bir boş toprağa tıkla!
            </p>
          </div>
        )}

        {room.phase === 'TURN_SELECT' && isMyTurn && (
          <div className="bg-slate-900/95 border-2 border-slate-700 rounded-2xl p-3 sm:p-4 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-center sm:text-left">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Hamle Planı
              </div>
              {!selectedSource && !selectedTarget && (
                <p className="text-xs sm:text-sm font-bold text-slate-200 mt-0.5">
                  Haritadan komşu bir <span className="text-amber-300">boş toprağa</span> (Silgi At) veya{' '}
                  <span className="text-rose-400">rakip toprağa</span> (Saldır) tıkla!
                </p>
              )}
              {selectedSource && !selectedTarget && (
                <p className="text-xs sm:text-sm font-bold text-slate-200 mt-0.5">
                  Çıkış Toprağı: <strong className="text-white">#{selectedSource.label}</strong> ➡️ Şimdi komşu bir hedef toprağa tıkla!
                </p>
              )}
              {selectedSource && selectedTarget && (
                <p className="text-xs sm:text-sm font-bold text-white mt-0.5">
                  <span className="text-amber-300">#{selectedSource.label}</span> sınırından ➡️{' '}
                  <span className="text-emerald-300">#{selectedTarget.label}</span>{' '}
                  {targetOwner ? `(${targetOwner.name})` : '(Boş Toprak)'}
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 shrink-0">
              {selectedSource && selectedTarget && selectedTarget.owner === null && (
                <button
                  onClick={throwEraser}
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-sm sm:text-base shadow-xl shadow-emerald-600/30 border-2 border-white transition transform hover:scale-105 cursor-pointer"
                >
                  🎲 SİLGİ AT (W / L)
                </button>
              )}

              {selectedSource &&
                selectedTarget &&
                selectedTarget.owner !== null &&
                selectedTarget.owner !== mySocketId && (
                  <button
                    onClick={startAttack}
                    className="px-6 py-3 rounded-2xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-black text-sm sm:text-base shadow-xl shadow-rose-600/30 border-2 border-white transition transform hover:scale-105 cursor-pointer"
                  >
                    ⚔️ SALDIR (TAŞ-KAĞIT-MAKAS)
                  </button>
                )}
            </div>
          </div>
        )}
      </div>

      {/* GAME OVER Modal */}
      {room.phase === 'GAME_OVER' && room.winner && (
        <div className="pointer-events-auto fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-amber-400 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
            <div className="text-6xl mb-3">👑</div>
            <span className="text-xs font-black uppercase tracking-widest text-amber-400">
              OYUN BİTTİ • ZAFER!
            </span>
            <h2
              className="text-3xl font-black mt-1"
              style={{ color: room.winner.color }}
            >
              {room.winner.name}
            </h2>
            <p className="text-sm text-slate-300 mt-3 leading-relaxed">
              {room.winner.reason}
            </p>

            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
              {isHost ? (
                <button
                  onClick={returnToLobby}
                  className="px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm shadow-lg transition cursor-pointer"
                >
                  🔄 Yeni Haritada Tekrar Oyna
                </button>
              ) : (
                <p className="text-xs text-slate-400 font-semibold self-center">
                  Oda kurucusunun yeni maç başlatması bekleniyor...
                </p>
              )}
              <button
                onClick={leaveRoom}
                className="px-5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm transition cursor-pointer"
              >
                Ana Menüye Dön
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
