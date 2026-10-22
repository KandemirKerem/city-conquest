import React, { useEffect, useState } from 'react';
import { useGameStore } from '../store/useGameStore';

const CHOICES = [
  { id: 'rock', label: 'TAŞ', emoji: '🪨', desc: 'Makası kırar' },
  { id: 'paper', label: 'KAĞIT', emoji: '📄', desc: 'Taşı sarar' },
  { id: 'scissors', label: 'MAKAS', emoji: '✂️', desc: 'Kağıdı keser' },
];

export default function RpsBattleModal() {
  const room = useGameStore((s) => s.room);
  const mySocketId = useGameStore((s) => s.mySocketId);
  const sendRpsChoice = useGameStore((s) => s.sendRpsChoice);

  const [myPicked, setMyPicked] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(15);

  const battle = room?.rpsBattle;

  useEffect(() => {
    setMyPicked(null);
  }, [battle?.id, battle?.round]);

  useEffect(() => {
    if (!battle?.deadline) return;
    const interval = setInterval(() => {
      const rem = Math.max(0, Math.ceil((battle.deadline - Date.now()) / 1000));
      setSecondsLeft(rem);
    }, 250);
    return () => clearInterval(interval);
  }, [battle?.deadline]);

  if (!battle || room?.phase !== 'RPS_BATTLE') return null;

  const isAttacker = mySocketId === battle.attackerId;
  const isDefender = mySocketId === battle.defenderId;
  const isParticipant = isAttacker || isDefender;

  const handleChoose = (choiceId) => {
    if (!isParticipant || battle.status !== 'CHOOSING' || myPicked) return;
    setMyPicked(choiceId);
    sendRpsChoice(choiceId);
  };

  const getChoiceDisplay = (c) => {
    const found = CHOICES.find((item) => item.id === c);
    return found || { label: '?', emoji: '❓' };
  };

  return (
    <div className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-slate-900 border-2 border-amber-500/60 rounded-3xl shadow-2xl overflow-hidden animate-fade-in">
        {/* Top Header */}
        <div className="bg-gradient-to-r from-rose-900/60 via-slate-900 to-blue-900/60 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs font-extrabold uppercase tracking-widest text-amber-400">
              ⚔️ TAŞ - KAĞIT - MAKAS DÜELLOSU • {battle.round}. TUR
            </span>
            <h2 className="text-lg sm:text-xl font-black text-white mt-0.5">
              Bölge #{battle.sourceLabel} ⚡ Bölge #{battle.targetLabel}
            </h2>
          </div>

          {battle.status === 'CHOOSING' && (
            <div className="flex items-center gap-2 bg-slate-950/90 border border-amber-500/40 px-3.5 py-1.5 rounded-full">
              <span className="text-xs text-slate-400 font-semibold">Süre:</span>
              <span className="text-base font-black text-amber-400">{secondsLeft}s</span>
            </div>
          )}
        </div>

        {/* Stakes Explanation Banner */}
        <div className="bg-slate-950/70 px-6 py-2.5 text-xs text-center text-slate-300 border-b border-slate-800/80">
          Saldıran kazanırsa <strong className="text-emerald-400">#{battle.targetLabel}</strong> toprağını alır • Kaybederse kendi sınır toprağı olan{' '}
          <strong className="text-rose-400">#{battle.sourceLabel}</strong> toprağını rakibe verir!
        </div>

        {/* Players Clash Arena */}
        <div className="p-6">
          <div className="grid grid-cols-3 items-center gap-3 mb-6">
            {/* Attacker Card */}
            <div className="bg-slate-950/90 border-2 rounded-2xl p-4 flex flex-col items-center text-center" style={{ borderColor: battle.attackerColor }}>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 mb-1">
                SALDIRAN (#{battle.sourceLabel})
              </span>
              <p className="font-extrabold text-sm sm:text-base text-white truncate max-w-full">
                {battle.attackerName}
              </p>

              <div className="mt-3 w-16 h-16 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center text-3xl shadow-inner">
                {battle.status === 'CHOOSING' ? (
                  battle.attackerChoice ? '🔒' : '⏳'
                ) : (
                  getChoiceDisplay(battle.attackerChoice).emoji
                )}
              </div>
              <span className="mt-1.5 text-xs font-bold text-slate-400">
                {battle.status === 'CHOOSING'
                  ? battle.attackerChoice
                    ? 'Seçimini Yaptı!'
                    : 'Düşünüyor...'
                  : getChoiceDisplay(battle.attackerChoice).label}
              </span>
            </div>

            {/* VS Center */}
            <div className="flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center font-black text-amber-300 text-lg shadow-lg">
                VS
              </div>
              {battle.status === 'REVEAL' && (
                <div
                  className={`mt-3 px-3 py-1.5 rounded-xl font-black text-xs uppercase tracking-wider border ${
                    battle.result === 'DRAW'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-400'
                      : battle.result === 'ATTACKER_WIN'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400'
                      : 'bg-sky-500/20 text-sky-300 border-sky-400'
                  }`}
                >
                  {battle.result === 'DRAW'
                    ? '🤝 BERABERE! Tekrar!'
                    : battle.result === 'ATTACKER_WIN'
                    ? `🏆 ${battle.attackerName} Kazandı!`
                    : `🛡️ ${battle.defenderName} Savundu!`}
                </div>
              )}
            </div>

            {/* Defender Card */}
            <div className="bg-slate-950/90 border-2 rounded-2xl p-4 flex flex-col items-center text-center" style={{ borderColor: battle.defenderColor }}>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 mb-1">
                SAVUNAN (#{battle.targetLabel})
              </span>
              <p className="font-extrabold text-sm sm:text-base text-white truncate max-w-full">
                {battle.defenderName}
              </p>

              <div className="mt-3 w-16 h-16 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center text-3xl shadow-inner">
                {battle.status === 'CHOOSING' ? (
                  battle.defenderChoice ? '🔒' : '⏳'
                ) : (
                  getChoiceDisplay(battle.defenderChoice).emoji
                )}
              </div>
              <span className="mt-1.5 text-xs font-bold text-slate-400">
                {battle.status === 'CHOOSING'
                  ? battle.defenderChoice
                    ? 'Seçimini Yaptı!'
                    : 'Düşünüyor...'
                  : getChoiceDisplay(battle.defenderChoice).label}
              </span>
            </div>
          </div>

          {/* Selection Buttons for Active Duelists */}
          {isParticipant && battle.status === 'CHOOSING' ? (
            <div>
              <p className="text-center text-xs font-bold uppercase tracking-wider text-amber-300 mb-3">
                {myPicked
                  ? 'Seçimin kilitlendi! Rakibin seçimi bekleniyor...'
                  : 'Hamleni Seç (Rakip Göremez):'}
              </p>
              <div className="grid grid-cols-3 gap-3">
                {CHOICES.map((c) => {
                  const selected = myPicked === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => handleChoose(c.id)}
                      disabled={Boolean(myPicked)}
                      className={`p-4 rounded-2xl border-2 flex flex-col items-center transition-all ${
                        selected
                          ? 'bg-amber-500 text-slate-950 border-white scale-105 shadow-xl'
                          : myPicked
                          ? 'bg-slate-800/40 text-slate-500 border-slate-800 opacity-50 cursor-not-allowed'
                          : 'bg-slate-800/90 hover:bg-slate-700 text-white border-slate-600 hover:border-amber-400 hover:-translate-y-1 cursor-pointer'
                      }`}
                    >
                      <span className="text-4xl mb-1.5">{c.emoji}</span>
                      <span className="font-black text-sm tracking-wide">{c.label}</span>
                      <span className="text-[10px] opacity-75 mt-0.5">{c.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5 text-center text-xs font-semibold text-slate-300">
              {battle.status === 'CHOOSING'
                ? '👀 Düello devam ediyor — oyuncular gizlice Taş, Kağıt veya Makas seçiyor...'
                : battle.result === 'DRAW'
                ? 'Berabere kalındı! Bir sonraki tur hemen başlıyor...'
                : battle.result === 'ATTACKER_WIN'
                ? `${battle.attackerName}, #${battle.targetLabel} toprağını fethetti!`
                : `${battle.attackerName} savaşı kaybetti ve saldırdığı #${battle.sourceLabel} sınır toprağını ${battle.defenderName} oyuncusuna verdi!`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
