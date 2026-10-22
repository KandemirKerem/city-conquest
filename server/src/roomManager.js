import { generateVoronoiMap } from './mapGenerator.js';

export const PLAYER_COLORS = [
  { hex: '#ef4444', light: '#fca5a5', border: '#991b1b', name: 'Kırmızı Kalem' },
  { hex: '#2563eb', light: '#93c5fd', border: '#1e40af', name: 'Mavi Pilot' },
  { hex: '#10b981', light: '#6ee7b7', border: '#065f46', name: 'Yeşil Fosforlu' },
  { hex: '#d97706', light: '#fcd34d', border: '#92400e', name: 'Turuncu Keçeli' },
];

const BOT_NAMES = ['Silgici Berk', 'TKM Ustası Mert', 'Okul Birincisi Ece', 'Arka Sıra Kaan'];

// 6 faces of the school eraser: 3 faces are 'W', 3 faces are 'L' (Exact 50% W / 50% L)
const ERASER_FACES = [
  { id: 'wide_W', outcome: 'W', label: 'Geniş Yüz (W)', weight: 0.32, normal: [0, 1, 0] },
  { id: 'wide_L', outcome: 'L', label: 'Geniş Yüz (L)', weight: 0.32, normal: [0, -1, 0] },
  { id: 'side_W', outcome: 'W', label: 'Yan Yüz (W)', weight: 0.14, normal: [0, 0, 1] },
  { id: 'side_L', outcome: 'L', label: 'Yan Yüz (L)', weight: 0.14, normal: [0, 0, -1] },
  { id: 'stand_W', outcome: 'W', label: 'Dik Yüz! (W)', weight: 0.04, normal: [1, 0, 0] },
  { id: 'stand_L', outcome: 'L', label: 'Dik Yüz! (L)', weight: 0.04, normal: [-1, 0, 0] },
];

function rollEraserFace() {
  const r = Math.random();
  let acc = 0;
  for (const face of ERASER_FACES) {
    acc += face.weight;
    if (r <= acc) return face;
  }
  return ERASER_FACES[0];
}

function generateRoomCode(existingRooms) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  do {
    code = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (existingRooms.has(code));
  return code;
}

export class RoomManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map(); // code -> room object
    this.socketToRoom = new Map(); // socket.id -> roomCode
    this.timers = new Map(); // roomCode -> timeoutId
  }

  clearRoomTimer(code) {
    if (this.timers.has(code)) {
      clearTimeout(this.timers.get(code));
      this.timers.delete(code);
    }
  }

  getPublicRoomsList() {
    const list = [];
    for (const room of this.rooms.values()) {
      if (room.isPublic && room.phase === 'LOBBY') {
        list.push({
          code: room.code,
          name: room.name,
          playerCount: room.players.length,
          maxPlayers: 4,
          hasPassword: Boolean(room.password && room.password.trim().length > 0),
          regionCount: room.regionCount,
          hostName: room.players.find((p) => p.id === room.hostId)?.name || 'Oyuncu',
        });
      }
    }
    return list;
  }

  broadcastLobbyList() {
    this.io.emit('public_rooms_update', this.getPublicRoomsList());
  }

  sanitizeRoomForClient(room) {
    // Hide secret RPS choices while status === 'CHOOSING'
    let rpsState = null;
    if (room.rpsBattle) {
      const isChoosing = room.rpsBattle.status === 'CHOOSING';
      rpsState = {
        ...room.rpsBattle,
        attackerChoice: isChoosing ? (room.rpsBattle.attackerChoice ? 'LOCKED' : null) : room.rpsBattle.attackerChoice,
        defenderChoice: isChoosing ? (room.rpsBattle.defenderChoice ? 'LOCKED' : null) : room.rpsBattle.defenderChoice,
      };
    }

    return {
      code: room.code,
      name: room.name,
      hostId: room.hostId,
      isPublic: room.isPublic,
      hasPassword: Boolean(room.password),
      regionCount: room.regionCount,
      phase: room.phase,
      players: room.players,
      spectators: room.spectators,
      currentTurnIndex: room.currentTurnIndex,
      activePlayerId: room.players[room.currentTurnIndex]?.id || null,
      selectedSourceId: room.selectedSourceId,
      selectedTargetId: room.selectedTargetId,
      map: room.map,
      eraserToss: room.eraserToss,
      rpsBattle: rpsState,
      logs: room.logs.slice(-25),
      winner: room.winner,
      turnDeadline: room.turnDeadline,
    };
  }

  broadcastRoom(room) {
    const payload = this.sanitizeRoomForClient(room);
    this.io.to(room.code).emit('room_state', payload);
  }

  addLog(room, text, type = 'info') {
    room.logs.push({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      text,
      type,
      timestamp: Date.now(),
    });
  }

  createRoom(socket, { playerName, roomName, isPublic = true, password = '', regionCount = 20 }) {
    this.leaveCurrentRoom(socket);

    const code = generateRoomCode(this.rooms);
    const cleanName = (playerName || 'Oyuncu 1').trim().slice(0, 18) || 'Oyuncu 1';
    const colorObj = PLAYER_COLORS[0];

    const hostPlayer = {
      id: socket.id,
      name: cleanName,
      slot: 0,
      color: colorObj.hex,
      lightColor: colorObj.light,
      borderColor: colorObj.border,
      colorName: colorObj.name,
      isBot: false,
      eliminated: false,
      isSpectator: false,
      territoryCount: 0,
    };

    const clampedRegions = Math.max(12, Math.min(32, Number(regionCount) || 20));
    const room = {
      code,
      name: (roomName || `${cleanName} Odası`).trim().slice(0, 28),
      hostId: socket.id,
      isPublic: Boolean(isPublic),
      password: password ? String(password).trim() : '',
      regionCount: clampedRegions,
      phase: 'LOBBY',
      players: [hostPlayer],
      spectators: [],
      currentTurnIndex: 0,
      selectedSourceId: null,
      selectedTargetId: null,
      map: generateVoronoiMap(clampedRegions),
      eraserToss: null,
      rpsBattle: null,
      logs: [],
      winner: null,
      turnDeadline: null,
    };

    this.addLog(room, `${cleanName} odayı kurdu. Oda Kodu: ${code}`, 'system');

    this.rooms.set(code, room);
    this.socketToRoom.set(socket.id, code);
    socket.join(code);

    this.broadcastRoom(room);
    this.broadcastLobbyList();
    return { ok: true, code };
  }

  joinRoom(socket, { code, playerName, password = '' }) {
    const cleanCode = String(code || '').trim().toUpperCase();
    const room = this.rooms.get(cleanCode);
    if (!room) {
      return { ok: false, error: 'Oda bulunamadı! Kodu kontrol edin.' };
    }

    if (room.password && room.password !== String(password || '').trim()) {
      return { ok: false, error: 'Oda şifresi hatalı!' };
    }

    this.leaveCurrentRoom(socket);
    const cleanName = (playerName || `Oyuncu ${room.players.length + 1}`).trim().slice(0, 18);

    // If game already started or 4 players full, join as Spectator
    if (room.phase !== 'LOBBY' || room.players.length >= 4) {
      const spec = {
        id: socket.id,
        name: cleanName,
        isSpectator: true,
      };
      room.spectators.push(spec);
      this.socketToRoom.set(socket.id, cleanCode);
      socket.join(cleanCode);
      this.addLog(room, `${cleanName} izleyici olarak katıldı.`, 'info');
      this.broadcastRoom(room);
      return { ok: true, code: cleanCode, asSpectator: true };
    }

    // Find available color slot (0..3)
    const usedSlots = new Set(room.players.map((p) => p.slot));
    let slot = 0;
    while (usedSlots.has(slot) && slot < 4) slot++;
    const colorObj = PLAYER_COLORS[slot];

    const newPlayer = {
      id: socket.id,
      name: cleanName,
      slot,
      color: colorObj.hex,
      lightColor: colorObj.light,
      borderColor: colorObj.border,
      colorName: colorObj.name,
      isBot: false,
      eliminated: false,
      isSpectator: false,
      territoryCount: 0,
    };

    room.players.push(newPlayer);
    this.socketToRoom.set(socket.id, cleanCode);
    socket.join(cleanCode);

    this.addLog(room, `${cleanName} masaya oturdu (${colorObj.name}).`, 'info');
    this.broadcastRoom(room);
    this.broadcastLobbyList();
    return { ok: true, code: cleanCode };
  }

  addBot(socket) {
    const room = this.getRoomBySocket(socket);
    if (!room || room.hostId !== socket.id || room.phase !== 'LOBBY') return;
    if (room.players.length >= 4) return;

    const usedSlots = new Set(room.players.map((p) => p.slot));
    let slot = 0;
    while (usedSlots.has(slot) && slot < 4) slot++;
    const colorObj = PLAYER_COLORS[slot];
    const botName = BOT_NAMES[slot] || `Bot ${slot + 1}`;

    room.players.push({
      id: `bot_${Date.now()}_${slot}`,
      name: `${botName} 🤖`,
      slot,
      color: colorObj.hex,
      lightColor: colorObj.light,
      borderColor: colorObj.border,
      colorName: colorObj.name,
      isBot: true,
      eliminated: false,
      isSpectator: false,
      territoryCount: 0,
    });

    this.addLog(room, `${botName} 🤖 odaya eklendi.`, 'info');
    this.broadcastRoom(room);
    this.broadcastLobbyList();
  }

  removePlayerOrBot(socket, targetId) {
    const room = this.getRoomBySocket(socket);
    if (!room || room.hostId !== socket.id || room.phase !== 'LOBBY') return;
    if (targetId === room.hostId) return;

    const idx = room.players.findIndex((p) => p.id === targetId);
    if (idx !== -1) {
      const removed = room.players[idx];
      room.players.splice(idx, 1);
      this.addLog(room, `${removed.name} odadan çıkarıldı.`, 'info');
      this.broadcastRoom(room);
      this.broadcastLobbyList();
    }
  }

  regenerateLobbyMap(socket, regionCount) {
    const room = this.getRoomBySocket(socket);
    if (!room || room.hostId !== socket.id || room.phase !== 'LOBBY') return;
    if (regionCount) {
      room.regionCount = Math.max(12, Math.min(32, Number(regionCount) || 20));
    }
    room.map = generateVoronoiMap(room.regionCount);
    this.addLog(room, `Kağıda yeni bir harita çizildi (${room.regionCount} bölge).`, 'system');
    this.broadcastRoom(room);
    this.broadcastLobbyList();
  }

  startGame(socket) {
    const room = this.getRoomBySocket(socket);
    if (!room || room.hostId !== socket.id || room.phase !== 'LOBBY') return;
    if (room.players.length < 2) {
      socket.emit('error_msg', 'Oyunu başlatmak için en az 2 oyuncu (veya Bot) gerekli!');
      return;
    }

    // Reset territories and players
    room.map.territories.forEach((t) => {
      t.owner = null;
    });
    room.players.forEach((p) => {
      p.eliminated = false;
      p.isSpectator = false;
      p.territoryCount = 0;
    });

    room.phase = 'INITIAL_PICK';
    room.currentTurnIndex = 0;
    room.selectedSourceId = null;
    room.selectedTargetId = null;
    room.eraserToss = null;
    room.rpsBattle = null;
    room.winner = null;

    this.addLog(
      room,
      `Oyun başladı! Herkes sırayla başlangıç toprağını seçiyor. Sıra: ${room.players[0].name}`,
      'system'
    );
    this.broadcastRoom(room);
    this.broadcastLobbyList();
    this.scheduleTurnOrBotAction(room);
  }

  // Phase 1: Initial territory pick (everyone picks 1 empty territory freely)
  handleInitialPick(socket, territoryId) {
    const room = this.getRoomBySocket(socket);
    if (!room || room.phase !== 'INITIAL_PICK') return;

    const currentPlayer = room.players[room.currentTurnIndex];
    if (!currentPlayer || currentPlayer.id !== socket.id) return;

    this.executeInitialPick(room, currentPlayer, Number(territoryId));
  }

  executeInitialPick(room, player, territoryId) {
    const territory = room.map.territories[territoryId];
    if (!territory || territory.owner !== null) return;

    this.clearRoomTimer(room.code);
    territory.owner = player.id;
    this.recalculateCounts(room);

    this.addLog(room, `${player.name}, #${territory.label} numaralı toprağı başlangıç üssü seçti!`, 'pick');

    // Find next player who still has 0 territories
    const nextIdx = room.players.findIndex((p) => p.territoryCount === 0);
    if (nextIdx !== -1) {
      room.currentTurnIndex = nextIdx;
      this.broadcastRoom(room);
      this.scheduleTurnOrBotAction(room);
    } else {
      // Everyone picked their starting territory -> Enter TURN_SELECT
      room.phase = 'TURN_SELECT';
      room.currentTurnIndex = 0;
      room.selectedSourceId = null;
      room.selectedTargetId = null;
      this.addLog(
        room,
        `Başlangıç seçimleri tamamlandı! Şimdi sıra ${room.players[0].name} oyuncusunda.`,
        'system'
      );
      this.broadcastRoom(room);
      this.scheduleTurnOrBotAction(room);
    }
  }

  // Active player selects source territory and/or target territory on the map
  handleSelectTerritories(socket, { sourceId, targetId }) {
    const room = this.getRoomBySocket(socket);
    if (!room || room.phase !== 'TURN_SELECT') return;
    const activePlayer = room.players[room.currentTurnIndex];
    if (!activePlayer || activePlayer.id !== socket.id) return;

    const sTerr = sourceId !== null && sourceId !== undefined ? room.map.territories[Number(sourceId)] : null;
    const tTerr = targetId !== null && targetId !== undefined ? room.map.territories[Number(targetId)] : null;

    if (sTerr && sTerr.owner === activePlayer.id) {
      room.selectedSourceId = sTerr.id;
    } else if (sourceId === null) {
      room.selectedSourceId = null;
    }

    if (
      tTerr &&
      room.selectedSourceId !== null &&
      room.map.territories[room.selectedSourceId].neighbors.includes(tTerr.id) &&
      tTerr.owner !== activePlayer.id
    ) {
      room.selectedTargetId = tTerr.id;
    } else {
      room.selectedTargetId = null;
    }

    this.broadcastRoom(room);
  }

  // Option A: Throw the 3D eraser to claim an empty neighboring territory
  handleThrowEraser(socket, payload = {}) {
    const room = this.getRoomBySocket(socket);
    if (!room || room.phase !== 'TURN_SELECT') return;
    const activePlayer = room.players[room.currentTurnIndex];
    if (!activePlayer || activePlayer.id !== socket.id) return;

    const sourceId = payload.sourceId ?? room.selectedSourceId;
    const targetId = payload.targetId ?? room.selectedTargetId;

    this.executeEraserToss(room, activePlayer, Number(sourceId), Number(targetId));
  }

  executeEraserToss(room, player, sourceId, targetId) {
    const source = room.map.territories[sourceId];
    const target = room.map.territories[targetId];
    if (!source || !target) return;
    if (source.owner !== player.id) return;
    if (target.owner !== null) return;
    if (!source.neighbors.includes(target.id)) return;

    this.clearRoomTimer(room.code);
    room.selectedSourceId = source.id;
    room.selectedTargetId = target.id;
    room.phase = 'ERASER_TOSS';

    const face = rollEraserFace();
    const tossSeed = Math.floor(Math.random() * 1000000);

    room.eraserToss = {
      id: `toss_${Date.now()}`,
      playerId: player.id,
      playerName: player.name,
      sourceId: source.id,
      targetId: target.id,
      targetCenter: target.center,
      faceId: face.id,
      faceLabel: face.label,
      outcome: face.outcome, // 'W' or 'L'
      seed: tossSeed,
      resolved: false,
    };

    this.addLog(
      room,
      `🎲 ${player.name}, #${target.label} numaralı boş toprağı almak için silgiyi fırlattı!`,
      'toss'
    );
    this.broadcastRoom(room);

    // Wait 3.4s for the 3D physics bounce / 2D animation to complete on all clients, then apply outcome
    const timer = setTimeout(() => {
      if (!this.rooms.has(room.code) || room.phase !== 'ERASER_TOSS') return;

      room.eraserToss.resolved = true;
      if (face.outcome === 'W') {
        target.owner = player.id;
        this.addLog(
          room,
          `✅ SİLGİ 'W' GELDİ! (${face.label}) — ${player.name}, #${target.label} numaralı toprağı ele geçirdi!`,
          'win'
        );
      } else {
        this.addLog(
          room,
          `❌ SİLGİ 'L' GELDİ! (${face.label}) — ${player.name}, #${target.label} toprağını alamadı.`,
          'lose'
        );
      }

      this.broadcastRoom(room);

      const nextTimer = setTimeout(() => {
        if (!this.rooms.has(room.code)) return;
        room.eraserToss = null;
        if (!this.checkEliminationsAndVictory(room)) {
          this.advanceTurn(room);
        }
      }, 1300);
      this.timers.set(room.code, nextTimer);
    }, 3200);

    this.timers.set(room.code, timer);
  }

  // Option B: Attack an enemy neighboring territory -> Start Rock-Paper-Scissors battle!
  handleStartAttack(socket, payload = {}) {
    const room = this.getRoomBySocket(socket);
    if (!room || room.phase !== 'TURN_SELECT') return;
    const activePlayer = room.players[room.currentTurnIndex];
    if (!activePlayer || activePlayer.id !== socket.id) return;

    const sourceId = payload.sourceId ?? room.selectedSourceId;
    const targetId = payload.targetId ?? room.selectedTargetId;

    this.executeStartAttack(room, activePlayer, Number(sourceId), Number(targetId));
  }

  executeStartAttack(room, attacker, sourceId, targetId) {
    const source = room.map.territories[sourceId];
    const target = room.map.territories[targetId];
    if (!source || !target) return;
    if (source.owner !== attacker.id) return;
    if (!target.owner || target.owner === attacker.id) return;
    if (!source.neighbors.includes(target.id)) return;

    const defender = room.players.find((p) => p.id === target.owner);
    if (!defender) return;

    this.clearRoomTimer(room.code);
    room.selectedSourceId = source.id;
    room.selectedTargetId = target.id;
    room.phase = 'RPS_BATTLE';

    room.rpsBattle = {
      id: `rps_${Date.now()}`,
      round: 1,
      status: 'CHOOSING', // 'CHOOSING' | 'REVEAL'
      attackerId: attacker.id,
      attackerName: attacker.name,
      attackerColor: attacker.color,
      defenderId: defender.id,
      defenderName: defender.name,
      defenderColor: defender.color,
      sourceId: source.id,
      sourceLabel: source.label,
      targetId: target.id,
      targetLabel: target.label,
      attackerChoice: null,
      defenderChoice: null,
      result: null, // 'ATTACKER_WIN' | 'DEFENDER_WIN' | 'DRAW'
      deadline: Date.now() + 15000,
    };

    this.addLog(
      room,
      `⚔️ SALDIRI! ${attacker.name} (#${source.label}) ⚡ ${defender.name} (#${target.label}) — Taş-Kağıt-Makas düellosu başladı!`,
      'battle'
    );
    this.broadcastRoom(room);
    this.scheduleRpsTimeoutAndBots(room);
  }

  handleRpsChoice(socket, choice) {
    const room = this.getRoomBySocket(socket);
    if (!room || room.phase !== 'RPS_BATTLE' || !room.rpsBattle) return;
    if (room.rpsBattle.status !== 'CHOOSING') return;
    if (!['rock', 'paper', 'scissors'].includes(choice)) return;

    const battle = room.rpsBattle;
    if (socket.id === battle.attackerId && !battle.attackerChoice) {
      battle.attackerChoice = choice;
    } else if (socket.id === battle.defenderId && !battle.defenderChoice) {
      battle.defenderChoice = choice;
    } else {
      return;
    }

    this.broadcastRoom(room);
    this.checkRpsResolution(room);
  }

  scheduleRpsTimeoutAndBots(room) {
    this.clearRoomTimer(room.code);
    const battle = room.rpsBattle;
    if (!battle || battle.status !== 'CHOOSING') return;

    const attacker = room.players.find((p) => p.id === battle.attackerId);
    const defender = room.players.find((p) => p.id === battle.defenderId);
    const choices = ['rock', 'paper', 'scissors'];

    if (attacker?.isBot) {
      setTimeout(() => {
        if (this.rooms.has(room.code) && room.rpsBattle?.id === battle.id && !battle.attackerChoice) {
          battle.attackerChoice = choices[Math.floor(Math.random() * 3)];
          this.broadcastRoom(room);
          this.checkRpsResolution(room);
        }
      }, 1100);
    }

    if (defender?.isBot) {
      setTimeout(() => {
        if (this.rooms.has(room.code) && room.rpsBattle?.id === battle.id && !battle.defenderChoice) {
          battle.defenderChoice = choices[Math.floor(Math.random() * 3)];
          this.broadcastRoom(room);
          this.checkRpsResolution(room);
        }
      }, 1400);
    }

    // 15s timeout for AFK players during RPS
    const timer = setTimeout(() => {
      if (!this.rooms.has(room.code) || room.phase !== 'RPS_BATTLE' || !room.rpsBattle) return;
      if (room.rpsBattle.status !== 'CHOOSING') return;
      if (!room.rpsBattle.attackerChoice) {
        room.rpsBattle.attackerChoice = choices[Math.floor(Math.random() * 3)];
      }
      if (!room.rpsBattle.defenderChoice) {
        room.rpsBattle.defenderChoice = choices[Math.floor(Math.random() * 3)];
      }
      this.checkRpsResolution(room);
    }, 15000);

    this.timers.set(room.code, timer);
  }

  checkRpsResolution(room) {
    const battle = room.rpsBattle;
    if (!battle || battle.status !== 'CHOOSING') return;
    if (!battle.attackerChoice || !battle.defenderChoice) return;

    this.clearRoomTimer(room.code);
    battle.status = 'REVEAL';

    const a = battle.attackerChoice;
    const d = battle.defenderChoice;

    const choiceNames = { rock: 'Taş 🪨', paper: 'Kağıt 📄', scissors: 'Makas ✂️' };

    if (a === d) {
      battle.result = 'DRAW';
      this.addLog(
        room,
        `🤝 BERABERE! İki oyuncu da ${choiceNames[a]} seçti. (${battle.round}. Tur tekrarlanıyor!)`,
        'info'
      );
      this.broadcastRoom(room);

      const timer = setTimeout(() => {
        if (!this.rooms.has(room.code) || room.phase !== 'RPS_BATTLE' || !room.rpsBattle) return;
        battle.round += 1;
        battle.status = 'CHOOSING';
        battle.attackerChoice = null;
        battle.defenderChoice = null;
        battle.result = null;
        battle.deadline = Date.now() + 15000;
        this.broadcastRoom(room);
        this.scheduleRpsTimeoutAndBots(room);
      }, 2500);
      this.timers.set(room.code, timer);
      return;
    }

    const attackerWins =
      (a === 'rock' && d === 'scissors') ||
      (a === 'paper' && d === 'rock') ||
      (a === 'scissors' && d === 'paper');

    const source = room.map.territories[battle.sourceId];
    const target = room.map.territories[battle.targetId];

    if (attackerWins) {
      battle.result = 'ATTACKER_WIN';
      if (target) target.owner = battle.attackerId;
      this.addLog(
        room,
        `🏆 ${battle.attackerName} (${choiceNames[a]}) > ${battle.defenderName} (${choiceNames[d]})! Saldırı başarılı, #${battle.targetLabel} toprağı fethedildi!`,
        'win'
      );
    } else {
      battle.result = 'DEFENDER_WIN';
      // Rule: If attacker loses, they give their bordering attacking territory (source) to the defender!
      if (source) source.owner = battle.defenderId;
      this.addLog(
        room,
        `🛡️ ${battle.defenderName} (${choiceNames[d]}) > ${battle.attackerName} (${choiceNames[a]})! Saldırı püskürtüldü, ${battle.attackerName} saldırdığı sınır toprağını (#${battle.sourceLabel}) rakibe kaptırdı!`,
        'lose'
      );
    }

    this.broadcastRoom(room);

    const timer = setTimeout(() => {
      if (!this.rooms.has(room.code)) return;
      room.rpsBattle = null;
      if (!this.checkEliminationsAndVictory(room)) {
        this.advanceTurn(room);
      }
    }, 2800);
    this.timers.set(room.code, timer);
  }

  recalculateCounts(room) {
    for (const p of room.players) {
      p.territoryCount = room.map.territories.filter((t) => t.owner === p.id).length;
    }
  }

  checkEliminationsAndVictory(room) {
    this.recalculateCounts(room);

    // 1. Check player eliminations (0 territories left)
    for (const p of room.players) {
      if (!p.eliminated && p.territoryCount === 0) {
        p.eliminated = true;
        p.isSpectator = true;
        this.addLog(
          room,
          `💀 ${p.name} tüm topraklarını kaybetti ve elendi! (Artık izleyici modunda)`,
          'eliminate'
        );
      }
    }

    // 2. Check 80% territory victory condition
    const target80 = room.map.winTargetCount;
    const eightyWinner = room.players.find((p) => !p.eliminated && p.territoryCount >= target80);
    if (eightyWinner) {
      this.finishGame(
        room,
        eightyWinner,
        `Haritanın %80'ini (${eightyWinner.territoryCount}/${room.map.totalTerritories} bölge) ele geçirerek mutlak hakimiyet kurdu!`
      );
      return true;
    }

    // 3. Check last player standing
    const alivePlayers = room.players.filter((p) => !p.eliminated);
    if (alivePlayers.length === 1) {
      this.finishGame(
        room,
        alivePlayers[0],
        `Masada kalan son oyuncu olarak tüm rakiplerini eledi!`
      );
      return true;
    }

    return false;
  }

  finishGame(room, winner, reason) {
    this.clearRoomTimer(room.code);
    room.phase = 'GAME_OVER';
    room.selectedSourceId = null;
    room.selectedTargetId = null;
    room.turnDeadline = null;
    room.winner = {
      id: winner.id,
      name: winner.name,
      color: winner.color,
      colorName: winner.colorName,
      territoryCount: winner.territoryCount,
      reason,
    };
    this.addLog(room, `👑 OYUN BİTTİ! Kazanan: ${winner.name} — ${reason}`, 'win');
    this.broadcastRoom(room);
  }

  advanceTurn(room) {
    const n = room.players.length;
    let nextIdx = room.currentTurnIndex;
    for (let i = 0; i < n; i++) {
      nextIdx = (nextIdx + 1) % n;
      const candidate = room.players[nextIdx];
      if (!candidate.eliminated && candidate.territoryCount > 0) {
        break;
      }
    }

    room.currentTurnIndex = nextIdx;
    room.phase = 'TURN_SELECT';
    room.selectedSourceId = null;
    room.selectedTargetId = null;

    const activePlayer = room.players[room.currentTurnIndex];
    this.addLog(room, `👉 Sıra ${activePlayer.name} oyuncusunda.`, 'turn');
    this.broadcastRoom(room);
    this.scheduleTurnOrBotAction(room);
  }

  scheduleTurnOrBotAction(room) {
    this.clearRoomTimer(room.code);
    const activePlayer = room.players[room.currentTurnIndex];
    if (!activePlayer) return;

    if (room.phase === 'INITIAL_PICK') {
      room.turnDeadline = Date.now() + 25000;
      this.broadcastRoom(room);

      if (activePlayer.isBot) {
        const timer = setTimeout(() => {
          if (!this.rooms.has(room.code) || room.phase !== 'INITIAL_PICK') return;
          const emptyList = room.map.territories.filter((t) => t.owner === null);
          if (emptyList.length > 0) {
            const pick = emptyList[Math.floor(Math.random() * emptyList.length)];
            this.executeInitialPick(room, activePlayer, pick.id);
          }
        }, 1000);
        this.timers.set(room.code, timer);
      } else {
        // Human timeout fallback
        const timer = setTimeout(() => {
          if (!this.rooms.has(room.code) || room.phase !== 'INITIAL_PICK') return;
          const emptyList = room.map.territories.filter((t) => t.owner === null);
          if (emptyList.length > 0) {
            const pick = emptyList[Math.floor(Math.random() * emptyList.length)];
            this.executeInitialPick(room, activePlayer, pick.id);
          }
        }, 25000);
        this.timers.set(room.code, timer);
      }
      return;
    }

    if (room.phase === 'TURN_SELECT') {
      room.turnDeadline = Date.now() + 30000;
      this.broadcastRoom(room);

      if (activePlayer.isBot) {
        const timer = setTimeout(() => {
          if (!this.rooms.has(room.code) || room.phase !== 'TURN_SELECT') return;
          this.performBotTurn(room, activePlayer);
        }, 1200);
        this.timers.set(room.code, timer);
      } else {
        // 30s turn timer for human players
        const timer = setTimeout(() => {
          if (!this.rooms.has(room.code) || room.phase !== 'TURN_SELECT') return;
          this.performBotTurn(room, activePlayer);
        }, 30000);
        this.timers.set(room.code, timer);
      }
    }
  }

  performBotTurn(room, player) {
    // Collect all valid moves (source owned by player -> neighbor not owned by player)
    const emptyMoves = [];
    const attackMoves = [];

    for (const t of room.map.territories) {
      if (t.owner !== player.id) continue;
      for (const nId of t.neighbors) {
        const neighbor = room.map.territories[nId];
        if (!neighbor || neighbor.owner === player.id) continue;
        if (neighbor.owner === null) {
          emptyMoves.push({ sourceId: t.id, targetId: neighbor.id });
        } else {
          attackMoves.push({ sourceId: t.id, targetId: neighbor.id });
        }
      }
    }

    // Prefer empty territories 65% of the time if available, else attack
    if (emptyMoves.length > 0 && (attackMoves.length === 0 || Math.random() < 0.65)) {
      const move = emptyMoves[Math.floor(Math.random() * emptyMoves.length)];
      this.executeEraserToss(room, player, move.sourceId, move.targetId);
    } else if (attackMoves.length > 0) {
      const move = attackMoves[Math.floor(Math.random() * attackMoves.length)];
      this.executeStartAttack(room, player, move.sourceId, move.targetId);
    } else {
      this.advanceTurn(room);
    }
  }

  returnToLobby(socket) {
    const room = this.getRoomBySocket(socket);
    if (!room || room.hostId !== socket.id) return;
    this.clearRoomTimer(room.code);

    room.phase = 'LOBBY';
    room.map = generateVoronoiMap(room.regionCount);
    room.players.forEach((p) => {
      p.eliminated = false;
      p.isSpectator = false;
      p.territoryCount = 0;
    });
    room.selectedSourceId = null;
    room.selectedTargetId = null;
    room.eraserToss = null;
    room.rpsBattle = null;
    room.winner = null;
    room.turnDeadline = null;

    this.addLog(room, 'Oda lobiye döndü ve yeni harita hazırlandı!', 'system');
    this.broadcastRoom(room);
    this.broadcastLobbyList();
  }

  getRoomBySocket(socket) {
    const code = this.socketToRoom.get(socket.id);
    if (!code) return null;
    return this.rooms.get(code) || null;
  }

  leaveCurrentRoom(socket) {
    const code = this.socketToRoom.get(socket.id);
    if (!code) return;
    this.socketToRoom.delete(socket.id);
    socket.leave(code);

    const room = this.rooms.get(code);
    if (!room) return;

    // Remove if spectator
    const specIdx = room.spectators.findIndex((s) => s.id === socket.id);
    if (specIdx !== -1) {
      room.spectators.splice(specIdx, 1);
      this.broadcastRoom(room);
      return;
    }

    const pIdx = room.players.findIndex((p) => p.id === socket.id);
    if (pIdx === -1) return;

    const leavingPlayer = room.players[pIdx];

    if (room.phase === 'LOBBY') {
      room.players.splice(pIdx, 1);
      const remainingHumans = room.players.filter((p) => !p.isBot);
      if (remainingHumans.length === 0) {
        this.clearRoomTimer(code);
        this.rooms.delete(code);
        this.broadcastLobbyList();
        return;
      }
      if (room.hostId === socket.id) {
        room.hostId = remainingHumans[0].id;
      }
      this.addLog(room, `${leavingPlayer.name} odadan ayrıldı.`, 'info');
      this.broadcastRoom(room);
      this.broadcastLobbyList();
    } else {
      // During active game: convert disconnected human to a Bot or mark eliminated if no humans left
      const remainingHumans = room.players.filter((p) => !p.isBot && p.id !== socket.id);
      if (remainingHumans.length === 0 && room.spectators.length === 0) {
        this.clearRoomTimer(code);
        this.rooms.delete(code);
        this.broadcastLobbyList();
        return;
      }

      leavingPlayer.isBot = true;
      leavingPlayer.name = `${leavingPlayer.name} (Bot 🤖)`;
      if (room.hostId === socket.id && remainingHumans.length > 0) {
        room.hostId = remainingHumans[0].id;
      }
      this.addLog(
        room,
        `${leavingPlayer.name} bağlantısı koptu; yerine Bot devam ediyor.`,
        'info'
      );
      this.broadcastRoom(room);

      // If it was their turn, schedule bot action
      if (room.players[room.currentTurnIndex]?.id === leavingPlayer.id) {
        this.scheduleTurnOrBotAction(room);
      }
    }
  }
}
