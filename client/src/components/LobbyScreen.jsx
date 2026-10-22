import React, { useEffect, useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import PaperMap2D from './PaperMap2D';

export default function LobbyScreen() {
  const playerName = useGameStore((s) => s.playerName);
  const setPlayerName = useGameStore((s) => s.setPlayerName);
  const room = useGameStore((s) => s.room);
  const mySocketId = useGameStore((s) => s.mySocketId);
  const publicRooms = useGameStore((s) => s.publicRooms);
  const createRoom = useGameStore((s) => s.createRoom);
  const joinRoom = useGameStore((s) => s.joinRoom);
  const leaveRoom = useGameStore((s) => s.leaveRoom);
  const addBot = useGameStore((s) => s.addBot);
  const removePlayer = useGameStore((s) => s.removePlayer);
  const regenerateMap = useGameStore((s) => s.regenerateMap);
  const startGame = useGameStore((s) => s.startGame);
  const errorMsg = useGameStore((s) => s.errorMsg);

  const [joinCode, setJoinCode] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [roomName, setRoomName] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [roomPassword, setRoomPassword] = useState('');
  const [regionCount, setRegionCount] = useState(20);
  const [copiedLink, setCopiedLink] = useState(false);

  // Auto-fill room code if URL has ?room=XXXXX
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get('room');
    if (codeParam) {
      setJoinCode(codeParam.toUpperCase());
    }
  }, []);

  // INSIDE A ROOM LOBBY (WAITING FOR PLAYERS & MAP PREVIEW)
  if (room && room.phase === 'LOBBY') {
    const isHost = room.hostId === mySocketId;

    const copyInvite = () => {
      const url = `${window.location.origin}/?room=${room.code}`;
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    };

    return (
      <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col p-4 sm:p-6 overflow-y-auto">
        <div className="max-w-6xl w-full mx-auto flex flex-col gap-6 my-auto">
          {/* Top Room Banner */}
          <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl p-5 flex flex-wrap items-center justify-between gap-4 shadow-2xl">
            <div>
              <span className="text-xs font-black uppercase tracking-widest text-amber-400">
                SINIF LOBİSİ • 4 KİŞİLİK MASA
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-white mt-0.5">
                {room.name}
              </h1>
            </div>

            {/* 5-Digit Room Code Box */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="bg-slate-950 border-2 border-amber-500/60 px-4 py-2 rounded-2xl flex items-center gap-3">
                <div>
                  <div className="text-[10px] font-bold uppercase text-slate-400">
                    ODA KODU
                  </div>
                  <div className="text-2xl font-black tracking-widest text-amber-400">
                    {room.code}
                  </div>
                </div>
                <button
                  onClick={copyInvite}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs transition cursor-pointer"
                >
                  {copiedLink ? '✓ Link Kopyalandı' : '🔗 Davet Linki'}
                </button>
              </div>

              <button
                onClick={leaveRoom}
                className="px-4 py-3 rounded-2xl bg-slate-800 hover:bg-rose-950/80 hover:text-rose-300 text-slate-300 font-bold text-xs border border-slate-700 transition cursor-pointer"
              >
                Odadan Ayrıl
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="bg-rose-600/90 text-white font-bold text-sm px-4 py-2.5 rounded-2xl text-center">
              ⚠️ {errorMsg}
            </div>
          )}

          {/* Main Grid: Players Left, Live Drawn Map Preview Right */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Left Column: 4 Player Seats */}
            <div className="lg:col-span-5 bg-slate-900 border-2 border-slate-800 rounded-3xl p-5 flex flex-col justify-between shadow-xl">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-black uppercase tracking-wider text-slate-200">
                    Masadaki Oyuncular ({room.players.length}/4)
                  </h2>
                  {isHost && room.players.length < 4 && (
                    <button
                      onClick={addBot}
                      className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs shadow transition cursor-pointer"
                    >
                      + 🤖 Bot Ekle
                    </button>
                  )}
                </div>

                <div className="flex flex-col gap-3">
                  {[0, 1, 2, 3].map((slotIdx) => {
                    const p = room.players[slotIdx];
                    return (
                      <div
                        key={slotIdx}
                        className={`p-3.5 rounded-2xl border-2 flex items-center justify-between ${
                          p
                            ? 'bg-slate-950/90 border-slate-700'
                            : 'bg-slate-950/30 border-dashed border-slate-800'
                        }`}
                        style={{ borderColor: p ? p.color : undefined }}
                      >
                        {p ? (
                          <>
                            <div className="flex items-center gap-3">
                              <div
                                className="w-5 h-5 rounded-full border-2 border-white shadow"
                                style={{ backgroundColor: p.color }}
                              />
                              <div>
                                <div className="font-extrabold text-sm text-white flex items-center gap-2">
                                  <span>{p.name}</span>
                                  {p.id === room.hostId && (
                                    <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded font-black">
                                      KURUCU
                                    </span>
                                  )}
                                  {p.id === mySocketId && (
                                    <span className="text-[10px] text-emerald-400 font-bold">
                                      (Sen)
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-400 font-semibold">
                                  {p.colorName}
                                </div>
                              </div>
                            </div>

                            {isHost && p.id !== mySocketId && (
                              <button
                                onClick={() => removePlayer(p.id)}
                                className="text-xs font-bold text-rose-400 hover:text-rose-300 px-2 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 transition cursor-pointer"
                              >
                                Çıkar
                              </button>
                            )}
                          </>
                        ) : (
                          <span className="text-xs font-bold text-slate-500 py-1">
                            Boş Sıra #{slotIdx + 1} — Oyuncu veya Bot Bekleniyor...
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Start Game Action */}
              <div className="mt-6 pt-4 border-t border-slate-800">
                {isHost ? (
                  <button
                    onClick={startGame}
                    disabled={room.players.length < 2}
                    className={`w-full py-4 rounded-2xl font-black text-base tracking-wide shadow-xl transition ${
                      room.players.length >= 2
                        ? 'bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-slate-950 cursor-pointer transform hover:scale-[1.01]'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    🚀 OYUNU BAŞLAT ({room.players.length}/4 Oyuncu)
                  </button>
                ) : (
                  <div className="text-center py-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs font-bold text-amber-300">
                    ⏳ Oda kurucusunun oyunu başlatması bekleniyor...
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Live Drawn Voronoi Map Preview */}
            <div className="lg:col-span-7 bg-slate-900 border-2 border-slate-800 rounded-3xl p-5 flex flex-col justify-between shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div>
                  <h2 className="text-base font-black uppercase tracking-wider text-slate-200">
                    Kağıt Harita Önizlemesi ({room.map.totalTerritories} Bölge)
                  </h2>
                  <p className="text-xs text-slate-400">
                    %80 Hakimiyet Hedefi:{' '}
                    <strong className="text-amber-400">
                      {room.map.winTargetCount} Toprak
                    </strong>
                  </p>
                </div>

                {isHost && (
                  <div className="flex items-center gap-2">
                    <select
                      value={room.regionCount}
                      onChange={(e) => regenerateMap(Number(e.target.value))}
                      className="bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-200"
                    >
                      <option value={16}>16 Bölge (Hızlı)</option>
                      <option value={20}>20 Bölge (Standart)</option>
                      <option value={24}>24 Bölge (Geniş)</option>
                      <option value={28}>28 Bölge (Destansı)</option>
                    </select>

                    <button
                      onClick={() => regenerateMap(room.regionCount)}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-extrabold text-xs transition cursor-pointer"
                    >
                      ✏️ Yeni Harita Çiz
                    </button>
                  </div>
                )}
              </div>

              <div className="flex-1 min-h-[280px] flex items-center justify-center">
                <PaperMap2D previewOnly={true} />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // MAIN MENU (CREATE OR JOIN ROOM)
  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="max-w-5xl w-full mx-auto my-auto flex flex-col gap-6">
        {/* Hero Header */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-black uppercase tracking-widest mb-2">
            🎲 Okul Sırası Efsanesi Web&apos;de!
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white">
            SİLGİ <span className="text-amber-400">SAVAŞLARI</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1.5 max-w-xl mx-auto">
            4 Kişilik Sıra Tabanlı İzometrik Strateji Oyunu — Boş topraklara{' '}
            <strong className="text-emerald-400">3W / 3L Silgi</strong> fırlat, rakip sınırlara{' '}
            <strong className="text-rose-400">Taş-Kağıt-Makas</strong> ile saldır, haritanın %80&apos;ini fethet!
          </p>
        </div>

        {errorMsg && (
          <div className="bg-rose-600/90 text-white font-bold text-sm px-4 py-2.5 rounded-2xl text-center">
            ⚠️ {errorMsg}
          </div>
        )}

        {/* Player Nickname Input */}
        <div className="bg-slate-900 border-2 border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 max-w-xl mx-auto w-full shadow-lg">
          <label className="text-xs font-black uppercase tracking-wider text-slate-300 shrink-0">
            👤 Oyuncu Adın:
          </label>
          <input
            type="text"
            maxLength={18}
            placeholder="Takma adını yaz (örn: Enes)"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 outline-none rounded-xl px-3.5 py-2 text-sm font-bold text-white"
          />
        </div>

        {/* 3 Columns: Join by Code / Create Room / Public Lobby Browser */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          {/* Create Room Card */}
          <div className="md:col-span-5 bg-slate-900 border-2 border-slate-800 rounded-3xl p-5 flex flex-col justify-between shadow-xl">
            <div>
              <h2 className="text-lg font-black text-amber-400 mb-3">
                ➕ Yeni Oda Kur
              </h2>

              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-400">Oda Adı</label>
                  <input
                    type="text"
                    maxLength={26}
                    placeholder="Örn: 10-B Arka Sıra"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm font-semibold text-white outline-none focus:border-amber-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-xs font-bold text-slate-400">Harita Boyutu</label>
                    <select
                      value={regionCount}
                      onChange={(e) => setRegionCount(Number(e.target.value))}
                      className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-xs font-bold text-white"
                    >
                      <option value={16}>16 Bölge (Hızlı)</option>
                      <option value={20}>20 Bölge (Normal)</option>
                      <option value={24}>24 Bölge (Büyük)</option>
                      <option value={28}>28 Bölge (Dev)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-400">Görünürlük</label>
                    <select
                      value={isPublic ? 'public' : 'private'}
                      onChange={(e) => setIsPublic(e.target.value === 'public')}
                      className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-xs font-bold text-white"
                    >
                      <option value="public">🌐 Herkese Açık</option>
                      <option value="private">🔒 Sadece Kodla</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400">
                    Oda Şifresi (İsteğe Bağlı)
                  </label>
                  <input
                    type="password"
                    maxLength={16}
                    placeholder="Şifresiz için boş bırakın"
                    value={roomPassword}
                    onChange={(e) => setRoomPassword(e.target.value)}
                    className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-white outline-none focus:border-amber-400"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={() =>
                createRoom({
                  roomName,
                  isPublic,
                  password: roomPassword,
                  regionCount,
                })
              }
              className="mt-5 w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-sm shadow-lg transition cursor-pointer"
            >
              🚀 Odayı Oluştur
            </button>
          </div>

          {/* Right 7 Cols: Join by 5-Digit Code + Public Rooms List */}
          <div className="md:col-span-7 flex flex-col gap-5">
            {/* Join by 5-Digit Code */}
            <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl p-5 shadow-xl">
              <h2 className="text-base font-black text-emerald-400 mb-2.5">
                🔑 5 Haneli Kod ile Odaya Katıl
              </h2>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  maxLength={5}
                  placeholder="KOD (Örn: K9X4M)"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  className="bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-base font-black tracking-widest text-amber-400 uppercase outline-none focus:border-emerald-400 sm:w-44 text-center"
                />
                <input
                  type="password"
                  placeholder="Şifre (varsa)"
                  value={joinPassword}
                  onChange={(e) => setJoinPassword(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs font-semibold text-white outline-none focus:border-emerald-400 flex-1"
                />
                <button
                  onClick={() => joinRoom({ code: joinCode, password: joinPassword })}
                  disabled={joinCode.trim().length < 3}
                  className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-black text-sm transition cursor-pointer"
                >
                  Katıl ➡️
                </button>
              </div>
            </div>

            {/* Public Rooms Browser */}
            <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl p-5 flex-1 flex flex-col shadow-xl">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-black text-sky-400">
                  🌐 Açık Odalar ({publicRooms.length})
                </h2>
                <span className="text-[11px] text-slate-400 font-semibold">
                  Canlı Liste
                </span>
              </div>

              {publicRooms.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-center py-8 border border-dashed border-slate-800 rounded-2xl text-xs font-semibold text-slate-500">
                  Şu an bekleyen açık oda yok. Hemen soldan ilk odayı sen kur!
                </div>
              ) : (
                <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                  {publicRooms.map((r) => (
                    <div
                      key={r.code}
                      className="bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-2xl px-4 py-2.5 flex items-center justify-between gap-2"
                    >
                      <div>
                        <div className="font-extrabold text-sm text-white flex items-center gap-2">
                          <span>{r.name}</span>
                          {r.hasPassword && <span title="Şifreli Oda">🔒</span>}
                          <span className="text-[10px] font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                            #{r.code}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Kurucu: {r.hostName} • {r.regionCount} Bölge
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-xs font-black text-slate-300 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
                          👤 {r.playerCount}/{r.maxPlayers}
                        </span>
                        <button
                          onClick={() => {
                            let pwd = '';
                            if (r.hasPassword) {
                              pwd = window.prompt('Bu oda şifreli. Lütfen oda şifresini girin:') || '';
                            }
                            joinRoom({ code: r.code, password: pwd });
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs transition cursor-pointer"
                        >
                          Gir
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
