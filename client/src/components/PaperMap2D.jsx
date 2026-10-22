import React, { useMemo } from 'react';
import { useGameStore } from '../store/useGameStore';

export default function PaperMap2D({ previewOnly = false }) {
  const room = useGameStore((s) => s.room);
  const mySocketId = useGameStore((s) => s.mySocketId);
  const onTerritoryClick = useGameStore((s) => s.onTerritoryClick);

  const map = room?.map;
  const playersMap = useMemo(() => {
    const m = {};
    room?.players?.forEach((p) => {
      m[p.id] = p;
    });
    return m;
  }, [room?.players]);

  if (!map) return null;

  const isMyTurn = room.activePlayerId === mySocketId;
  const selectedSource =
    room.selectedSourceId !== null ? map.territories[room.selectedSourceId] : null;
  const selectedTarget =
    room.selectedTargetId !== null ? map.territories[room.selectedTargetId] : null;

  // Determine which territories are valid targets right now for visual highlighting
  const validTargetIds = new Set();
  if (!previewOnly && isMyTurn && room.phase === 'TURN_SELECT') {
    if (selectedSource) {
      selectedSource.neighbors.forEach((nId) => {
        const nTerr = map.territories[nId];
        if (nTerr && nTerr.owner !== mySocketId) validTargetIds.add(nId);
      });
    } else {
      // Highlight any territory adjacent to ANY of my territories
      map.territories.forEach((t) => {
        if (t.owner === mySocketId) {
          t.neighbors.forEach((nId) => {
            const nTerr = map.territories[nId];
            if (nTerr && nTerr.owner !== mySocketId) validTargetIds.add(nId);
          });
        }
      });
    }
  }

  return (
    <div className="relative w-full h-full flex items-center justify-center p-2 sm:p-6 select-none overflow-hidden">
      {/* Notebook Paper Container */}
      <div className="relative w-full max-w-5xl aspect-[10/7] rounded-2xl shadow-2xl border-4 border-amber-900/40 paper-grid overflow-hidden flex items-center justify-center">
        {/* Red notebook margin line */}
        <div className="absolute top-0 bottom-0 left-8 sm:left-12 w-[2px] bg-red-400/40 pointer-events-none" />

        <svg
          viewBox={`0 0 ${map.width} ${map.height}`}
          className="w-full h-full drop-shadow-sm"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <filter id="handDrawnShadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.22" />
            </filter>
          </defs>

          {/* Render territories */}
          {map.territories.map((t) => {
            const owner = t.owner ? playersMap[t.owner] : null;
            const isSource = room.selectedSourceId === t.id;
            const isTarget = room.selectedTargetId === t.id;
            const isValidTarget = validTargetIds.has(t.id);
            const isInitialPickable =
              !previewOnly &&
              room.phase === 'INITIAL_PICK' &&
              isMyTurn &&
              t.owner === null;

            const pointsStr = t.polygon.map((p) => `${p[0]},${p[1]}`).join(' ');

            let fill = '#f3efe0';
            if (owner) {
              fill = isSource ? owner.color : owner.lightColor;
            } else if (isTarget) {
              fill = '#fde68a';
            } else if (isValidTarget || isInitialPickable) {
              fill = '#fef3c7';
            }

            let stroke = '#334155';
            let strokeWidth = 2.5;
            let strokeDasharray = 'none';

            if (isSource) {
              stroke = '#ffffff';
              strokeWidth = 5;
            } else if (isTarget) {
              stroke = '#ef4444';
              strokeWidth = 5;
            } else if (isValidTarget) {
              stroke = '#f59e0b';
              strokeWidth = 3.5;
              strokeDasharray = '8,4';
            }

            return (
              <g
                key={t.id}
                onClick={() => !previewOnly && onTerritoryClick(t.id)}
                className={!previewOnly ? 'cursor-pointer transition-opacity hover:opacity-90' : ''}
              >
                <polygon
                  points={pointsStr}
                  fill={fill}
                  fillOpacity={owner ? (isSource ? 0.92 : 0.78) : 0.85}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  strokeDasharray={strokeDasharray}
                  strokeLinejoin="round"
                  filter="url(#handDrawnShadow)"
                />

                {/* Territory center badge */}
                <g transform={`translate(${t.center[0]}, ${t.center[1]})`}>
                  <circle
                    r={isSource || isTarget ? 19 : 15}
                    fill={owner ? owner.color : '#1e293b'}
                    stroke="#ffffff"
                    strokeWidth={2}
                  />
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#ffffff"
                    fontSize={isSource || isTarget ? '14' : '12'}
                    fontWeight="800"
                  >
                    #{t.label}
                  </text>
                </g>
              </g>
            );
          })}

          {/* Attack / Action Line between selectedSource and selectedTarget */}
          {selectedSource && selectedTarget && (
            <g className="pointer-events-none">
              <line
                x1={selectedSource.center[0]}
                y1={selectedSource.center[1]}
                x2={selectedTarget.center[0]}
                y2={selectedTarget.center[1]}
                stroke={selectedTarget.owner ? '#ef4444' : '#10b981'}
                strokeWidth="5"
                strokeDasharray="10,6"
                strokeLinecap="round"
              />
              <circle
                cx={selectedTarget.center[0]}
                cy={selectedTarget.center[1]}
                r="26"
                fill="none"
                stroke={selectedTarget.owner ? '#ef4444' : '#10b981'}
                strokeWidth="3.5"
              />
            </g>
          )}
        </svg>

        {/* 2D Eraser Flip Overlay for Mobile / 2D Mode */}
        {room.phase === 'ERASER_TOSS' && room.eraserToss && (
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs flex flex-col items-center justify-center z-20 animate-fade-in">
            <div className="bg-slate-900/95 border-2 border-amber-500/60 rounded-2xl p-6 shadow-2xl flex flex-col items-center max-w-xs w-full text-center">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2">
                {room.eraserToss.playerName} Silgi Fırlattı!
              </p>

              {/* Animated 2D School Eraser */}
              <div
                className={`my-4 w-36 h-20 rounded-xl border-4 shadow-xl flex flex-col items-center justify-center transition-all duration-500 ${
                  !room.eraserToss.resolved
                    ? 'animate-bounce bg-gradient-to-r from-blue-600 via-white to-red-600 border-slate-200 rotate-12 scale-110'
                    : room.eraserToss.outcome === 'W'
                    ? 'bg-emerald-600 border-emerald-300 scale-105'
                    : 'bg-rose-600 border-rose-300 scale-100'
                }`}
              >
                {!room.eraserToss.resolved ? (
                  <span className="text-2xl font-black text-slate-900 tracking-widest animate-pulse">
                    W / L ?
                  </span>
                ) : (
                  <>
                    <span className="text-4xl font-black text-white drop-shadow">
                      {room.eraserToss.outcome}
                    </span>
                    <span className="text-[11px] font-semibold text-white/90 mt-0.5">
                      {room.eraserToss.faceLabel}
                    </span>
                  </>
                )}
              </div>

              <p className="text-sm font-bold text-slate-200 mt-2">
                {!room.eraserToss.resolved
                  ? 'Silgi masada takla atıyor...'
                  : room.eraserToss.outcome === 'W'
                  ? `🎉 W Geldi! #${room.eraserToss.targetId + 1} numaralı toprak alındı!`
                  : `💨 L Geldi! Toprak alınamadı.`}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
