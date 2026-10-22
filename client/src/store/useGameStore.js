import { create } from 'zustand';
import { io } from 'socket.io-client';

const isMobileScreen = () =>
  typeof window !== 'undefined' &&
  (window.innerWidth < 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));

// Connect to backend server (uses Vite proxy in dev or same origin in production)
const socketUrl = import.meta.env.VITE_SERVER_URL || window.location.origin;
export const socket = io(socketUrl, {
  autoConnect: true,
  reconnection: true,
});

export const useGameStore = create((set, get) => ({
  mySocketId: null,
  connected: false,
  playerName: localStorage.getItem('silgi_player_name') || '',
  room: null,
  publicRooms: [],
  errorMsg: null,

  // View & Camera state
  viewMode: isMobileScreen() ? '2D' : '3D', // '3D' (CK3 Table + Rapier) or '2D' (SVG Paper Map)
  cameraZoom: 0.35, // 0 = close isometric (48 deg), 1 = far top-down CK3 overview (88 deg)

  setPlayerName: (name) => {
    localStorage.setItem('silgi_player_name', name);
    set({ playerName: name });
  },

  setViewMode: (mode) => set({ viewMode: mode }),
  setCameraZoom: (zoom) =>
    set({ cameraZoom: Math.max(0, Math.min(1, typeof zoom === 'function' ? zoom(get().cameraZoom) : zoom)) }),

  clearError: () => set({ errorMsg: null }),

  initSocketListeners: () => {
    socket.off('connect');
    socket.off('disconnect');
    socket.off('public_rooms_update');
    socket.off('room_state');
    socket.off('error_msg');

    socket.on('connect', () => {
      set({ connected: true, mySocketId: socket.id });
    });

    socket.on('disconnect', () => {
      set({ connected: false });
    });

    socket.on('public_rooms_update', (rooms) => {
      set({ publicRooms: rooms || [] });
    });

    socket.on('room_state', (roomState) => {
      set({ room: roomState, mySocketId: socket.id });
    });

    socket.on('error_msg', (msg) => {
      set({ errorMsg: msg });
      setTimeout(() => {
        if (get().errorMsg === msg) set({ errorMsg: null });
      }, 4000);
    });

    if (socket.connected) {
      set({ connected: true, mySocketId: socket.id });
      socket.emit('request_public_rooms');
    }
  },

  createRoom: ({ roomName, isPublic, password, regionCount }, onDone) => {
    const playerName = get().playerName.trim() || 'Oyuncu 1';
    socket.emit(
      'create_room',
      { playerName, roomName, isPublic, password, regionCount },
      (res) => {
        if (!res?.ok) {
          set({ errorMsg: res?.error || 'Oda kurulamadı.' });
        }
        if (onDone) onDone(res);
      }
    );
  },

  joinRoom: ({ code, password = '' }, onDone) => {
    const playerName = get().playerName.trim() || 'Oyuncu';
    socket.emit('join_room', { code, playerName, password }, (res) => {
      if (!res?.ok) {
        set({ errorMsg: res?.error || 'Odaya girilemedi.' });
      }
      if (onDone) onDone(res);
    });
  },

  leaveRoom: () => {
    socket.emit('leave_room');
    set({ room: null });
  },

  addBot: () => socket.emit('add_bot'),
  removePlayer: (targetId) => socket.emit('remove_player', targetId),
  regenerateMap: (regionCount) => socket.emit('regenerate_map', regionCount),
  startGame: () => socket.emit('start_game'),
  returnToLobby: () => socket.emit('return_to_lobby'),

  onTerritoryClick: (territoryId) => {
    const { room, mySocketId } = get();
    if (!room || !mySocketId) return;

    const territory = room.map?.territories?.[territoryId];
    if (!territory) return;

    // 1. INITIAL_PICK phase: pick any unowned territory
    if (room.phase === 'INITIAL_PICK') {
      if (room.activePlayerId === mySocketId && territory.owner === null) {
        socket.emit('initial_pick', territoryId);
      }
      return;
    }

    // 2. TURN_SELECT phase: select source (own territory) and target (neighboring empty/enemy territory)
    if (room.phase === 'TURN_SELECT') {
      if (room.activePlayerId !== mySocketId) return;

      // Clicked own territory -> set as sourceTerritory
      if (territory.owner === mySocketId) {
        // Check if current target is also adjacent to this new source; if so keep target!
        const currentTarget =
          room.selectedTargetId !== null ? room.map.territories[room.selectedTargetId] : null;
        const keepTarget =
          currentTarget &&
          currentTarget.owner !== mySocketId &&
          territory.neighbors.includes(currentTarget.id);

        socket.emit('select_territories', {
          sourceId: territory.id,
          targetId: keepTarget ? currentTarget.id : null,
        });
        return;
      }

      // Clicked empty or enemy territory -> check if current selectedSource borders it, or auto-pick a bordering owned source
      const currentSource =
        room.selectedSourceId !== null ? room.map.territories[room.selectedSourceId] : null;

      if (
        currentSource &&
        currentSource.owner === mySocketId &&
        currentSource.neighbors.includes(territory.id)
      ) {
        socket.emit('select_territories', {
          sourceId: currentSource.id,
          targetId: territory.id,
        });
        return;
      }

      // Find any of my territories that borders this clicked target
      const myBorderingSources = room.map.territories.filter(
        (t) => t.owner === mySocketId && t.neighbors.includes(territory.id)
      );

      if (myBorderingSources.length > 0) {
        socket.emit('select_territories', {
          sourceId: myBorderingSources[0].id,
          targetId: territory.id,
        });
      } else {
        set({
          errorMsg: 'Bu bölgeye hamle yapmak için ona komşu (sınır) bir toprağın olmalı!',
        });
        setTimeout(() => set({ errorMsg: null }), 2800);
      }
    }
  },

  throwEraser: () => {
    const { room } = get();
    if (!room) return;
    socket.emit('throw_eraser', {
      sourceId: room.selectedSourceId,
      targetId: room.selectedTargetId,
    });
  },

  startAttack: () => {
    const { room } = get();
    if (!room) return;
    socket.emit('start_attack', {
      sourceId: room.selectedSourceId,
      targetId: room.selectedTargetId,
    });
  },

  sendRpsChoice: (choice) => {
    socket.emit('rps_choice', choice);
  },
}));
