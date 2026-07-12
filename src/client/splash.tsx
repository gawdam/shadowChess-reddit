import './index.css';

import { requestExpandedMode } from '@devvit/web/client';
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useCounter } from './hooks/useCounter';

const allPieceAssets = [
  'white_pawn',
  'white_knight',
  'white_bishop',
  'white_rook',
  'white_queen',
  'white_king',
  'black_pawn',
  'black_knight',
  'black_bishop',
  'black_rook',
  'black_queen',
  'black_king',
];

const pieceImgStyle: React.CSSProperties = {
  width: '96%',
  height: '96%',
  objectFit: 'contain',
  pointerEvents: 'auto',
  touchAction: 'none',
  transformOrigin: 'center center',
};

const parseFEN = (fen: string | undefined): (string | null)[] => {
  const normalized = fen?.trim() ?? '';
  const rows = normalized ? normalized.split(' ')[0]!.split('/') : [];
  const board: (string | null)[] = Array(64).fill(null);
  for (let r = 0; r < 8; r += 1) {
    const row = rows[r] || '';
    let file = 0;
    for (const ch of row) {
      if (ch >= '0' && ch <= '9') {
        file += Number(ch);
        continue;
      }
      const mapping: Record<string, string> = {
        P: 'white_pawn', N: 'white_knight', B: 'white_bishop', R: 'white_rook', Q: 'white_queen', K: 'white_king',
        p: 'black_pawn', n: 'black_knight', b: 'black_bishop', r: 'black_rook', q: 'black_queen', k: 'black_king',
      };
      board[r * 8 + file] = mapping[ch] ?? null;
      file += 1;
    }
  }
  return board;
};

const usePieceAssetsReady = () => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let remaining = allPieceAssets.length;

    const finish = () => {
      if (!cancelled) {
        setReady(true);
      }
    };

    if (remaining === 0) {
      finish();
      return;
    }

    const onAssetSettled = () => {
      remaining -= 1;
      if (remaining === 0) {
        window.requestAnimationFrame(() => finish());
      }
    };

    allPieceAssets.forEach((piece) => {
      const img = new Image();
      img.onload = onAssetSettled;
      img.onerror = onAssetSettled;
      img.src = `/pieces/${piece}.png`;
      if (img.complete) {
        onAssetSettled();
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return ready;
};

export const Splash = () => {
  const { loading, gameData, userData, simulationStats, playerCounts, leaderboards } = useCounter();
  const pieceAssetsReady = usePieceAssetsReady();
  const [now, setNow] = useState(() => Date.now());
  const board = gameData ? parseFEN(gameData.fen) : Array(64).fill(null);
  const whiteName = gameData?.meta.white ?? 'White';
  const blackName = gameData?.meta.black ?? 'Black';
  const turnLabel = gameData?.turn === 'b' ? 'Black to play' : 'White to play';
  const showBoardLoader = loading || !pieceAssetsReady || !gameData;
  const closesAt = gameData?.closesAt ?? null;
  const remainingMs = closesAt ? Math.max(0, closesAt - now) : 0;
  const isGameClosed = Boolean(closesAt && remainingMs <= 0);
  const remainingHours = Math.floor(remainingMs / (60 * 60 * 1000));
  const remainingMinutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
  const countdownLabel = `${String(remainingHours).padStart(2, '0')}:${String(remainingMinutes).padStart(2, '0')}`;
  const whiteStats = simulationStats.white;
  const blackStats = simulationStats.black;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const renderNeoPodium = (entries: typeof leaderboards.white.top, emptyLabel: string) => {
    const top3 = entries.slice(0, 3);
    if (top3.length === 0) {
      return <div className="text-xs font-bold text-black/60 p-2 text-center">{emptyLabel}</div>;
    }

    const visualOrder = [top3[1], top3[0], top3[2]];
    const layoutConfigs = [
      { place: '2nd', height: 'h-10', bg: 'bg-[#C4B5FD]' },
      { place: '1st', height: 'h-16', bg: 'bg-[#FFD93D]' },
      { place: '3rd', height: 'h-7', bg: 'bg-[#FF6B6B]' },
    ];

    return (
      <div className="flex items-end justify-center gap-1 pt-4 pb-1 px-0.5">
        {visualOrder.map((entry, index) => {
          if (!entry) return <div key={index} className="w-1/3 invisible" />;
          const config = layoutConfigs[index];

          return (
            <div key={`${entry.username}-${index}`} className="flex flex-col items-center w-1/3 min-w-0">
              <span className="text-[9px] font-bold text-black truncate w-full text-center mb-0.5">
                u/{entry.username}
              </span>
              <span className="text-[10px] font-black text-black mb-0.5">{entry.score}</span>
              <div className={`w-full ${config!.height} ${config!.bg} border-2 border-black rounded-none flex flex-col items-center justify-center shadow-[1px_1px_0px_0px_#000]`}>
                <span className="text-[8px] font-black text-black">
                  {config!.place}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (userData.hasSubmitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen w-full bg-[#FFFDF5] text-black p-3 select-none font-sans"
           style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
        
        <div className="w-full max-w-xl bg-white border-4 border-black rounded-none p-3 shadow-[8px_8px_0px_0px_#000] flex flex-col gap-3">
          
          {/* Header Block */}
          <div className="text-center border-b-2 border-black pb-2 relative">
            <h1 className="text-3xl font-black tracking-tighter uppercase text-black rotate-[-0.5deg] inline-block bg-[#FFD93D] px-4 py-0.5 border-4 border-black shadow-[4px_4px_0px_0px_#000]">
              ShadowChess
            </h1>
            <p className="text-[10px] tracking-widest uppercase font-bold text-black mt-2">Game Over • Performance Summary</p>
          </div>

          {/* Side-by-Side Main Split: Scoreboard Left, Leaderboards Right */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-stretch">
            
            {/* Left Side: Scoreboard & Micro Stats */}
            <div className="md:col-span-2 border-4 border-black rounded-none bg-white overflow-hidden shadow-[4px_4px_0px_0px_#000] flex flex-col justify-between">
              <div className="grid grid-cols-3 border-b-2 border-black text-center items-center bg-[#C4B5FD] divide-x-2 divide-black">
                <div className="p-1.5 flex flex-col items-center justify-center bg-white">
                  <img src="/pieces/white_king.png" alt="White" className="h-6 w-6 object-contain" />
                  <span className="text-[9px] font-bold mt-0.5">White</span>
                  <span className="text-sm font-black text-black">{whiteStats.totalScore}</span>
                </div>
                <div className="p-1.5 flex flex-col items-center justify-center bg-[#FFD93D]">
                  <span className="text-[8px] font-bold text-black whitespace-nowrap">Your score</span>
                  <span className="text-base font-black text-black">{userData.score ?? 0}</span>
                </div>
                <div className="p-1.5 flex flex-col items-center justify-center bg-white">
                  <img src="/pieces/black_king.png" alt="Black" className="h-6 w-6 object-contain" />
                  <span className="text-[9px] font-bold mt-0.5">Black</span>
                  <span className="text-sm font-black text-black">{blackStats.totalScore}</span>
                </div>
              </div>

              {/* Match Stats */}
              <div className="divide-y-2 divide-black text-[10px] font-bold bg-white flex-grow flex flex-col justify-around">
                {[
                  { label: 'Active players', white: playerCounts?.white ?? 0, black: playerCounts?.black ?? 0 },
                  { label: 'Illegal moves', white: whiteStats.illegalMoves, black: blackStats.illegalMoves },
                  { label: 'Piece captures', white: whiteStats.captures, black: blackStats.captures },
                ].map((stat) => (
                  <div key={stat.label} className="grid grid-cols-3 items-center text-center py-1 px-1">
                    <span className="font-black text-black">{stat.white}</span>
                    <span className="text-[8px] font-bold bg-slate-100 border-x border-black py-0.5 text-ellipsis overflow-hidden whitespace-nowrap">{stat.label}</span>
                    <span className="font-black text-black">{stat.black}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Side: Split Leaderboards */}
            <div className="md:col-span-3 grid grid-cols-2 gap-2">
              <div className="border-4 border-black rounded-none bg-white p-1.5 shadow-[4px_4px_0px_0px_#000] flex flex-col justify-between">
                <div className="text-[9px] font-bold text-center bg-black text-white py-0.5">
                  Leaderboard (White)
                </div>
                {renderNeoPodium(leaderboards.white.top, 'No scores recorded')}
              </div>
              
              <div className="border-4 border-black rounded-none bg-white p-1.5 shadow-[4px_4px_0px_0px_#000] flex flex-col justify-between">
                <div className="text-[9px] font-bold text-center bg-black text-white py-0.5">
                  Leaderboard (Black)
                </div>
                {renderNeoPodium(leaderboards.black.top, 'No scores recorded')}
              </div>
            </div>

          </div>

          {/* Compact Action Bar */}
          <div className="flex justify-center mt-0.5">
            <button
              className="w-full py-2 px-4 rounded-none bg-[#FF6B6B] border-4 border-black text-xs font-bold text-black tracking-wide shadow-[4px_4px_0px_0px_#000] transition-all duration-100 active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
              onClick={(e) => requestExpandedMode(e.nativeEvent, 'game')}
            >
              View my game board
            </button>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col justify-center items-center min-h-screen w-full bg-[#FFFDF5] text-black p-4 select-none font-sans"
         style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
      
      <div className="w-full max-w-sm flex flex-col justify-between rounded-none border-4 border-black bg-white p-4 shadow-[8px_8px_0px_0px_#000]">
        
        <div className="text-center mb-3">
          <h1 className="text-3xl font-black tracking-tighter uppercase text-black bg-[#FFD93D] px-3 py-1 border-4 border-black shadow-[4px_4px_0px_0px_#000] inline-block rotate-[1deg]">
            ShadowChess
          </h1>
        </div>

        <div className="relative w-full aspect-square rounded-none overflow-hidden border-4 border-black mb-4 shadow-[4px_4px_0px_0px_#000]">
          <div className="grid grid-cols-8 grid-rows-8 gap-0 w-full h-full">
            {board.map((piece, index) => {
              const row = Math.floor(index / 8);
              const col = index % 8;
              const isDark = (row + col) % 2 === 1;
              const backgroundColor = isDark ? '#B45309' : '#FEF3C7';

              return (
                <div 
                  key={index} 
                  className="flex items-center justify-center relative w-full h-full border-[0.5px] border-black/10"
                  style={{ backgroundColor }}
                >
                  {piece && (
                    <img 
                      src={`/pieces/${piece}.png`} 
                      alt={piece} 
                      className="w-full h-full object-contain" 
                      style={{
                        ...pieceImgStyle,
                        position: 'relative',
                        cursor: 'grab',
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
          {showBoardLoader && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/90 border-t-4 border-black">
              <div className="flex flex-col items-center gap-2 px-4 py-3 text-center text-black border-4 border-black bg-[#FFD93D] shadow-[4px_4px_0px_0px_#000]">
                <div className="text-xs font-bold">Loading board...</div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 pt-3 border-t-4 border-black">
          <div className="min-w-0">
            <div className="text-[9px] font-bold text-black/60">Closes in</div>
            <div className="text-xs font-bold text-black">{countdownLabel}</div>
          </div>
          <button
            className={`rounded-none px-4 py-2 text-xs font-bold border-4 border-black transition-all duration-100 shadow-[3px_3px_0px_0px_#000] ${isGameClosed ? 'bg-gray-300 cursor-not-allowed shadow-none translate-x-[3px] translate-y-[3px]' : 'bg-[#FF6B6B] text-black active:translate-x-[3px] active:translate-y-[3px] active:shadow-none'}`}
            disabled={isGameClosed}
            onClick={(e) => {
              if (isGameClosed) return;
              requestExpandedMode(e.nativeEvent, 'game');
            }}
          >
            {isGameClosed ? 'Closed' : 'Play now'}
          </button>
        </div>
      </div>

    </div>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <>
      <style>{'@keyframes asyncchess-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }'}</style>
      <Splash />
    </>
  </StrictMode>
);