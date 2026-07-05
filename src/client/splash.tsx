import './index.css';

import { navigateTo } from '@devvit/web/client';
import { context, requestExpandedMode } from '@devvit/web/client';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { useCounter } from './hooks/useCounter';

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

export const Splash = () => {
  const displayName = context.username?.trim() || 'player';
  const { loading, gameData } = useCounter();
  const board = gameData ? parseFEN(gameData.fen) : Array(64).fill(null);
  const whiteName = gameData?.meta.white ?? 'White';
  const blackName = gameData?.meta.black ?? 'Black';
  const turnLabel = gameData?.turn === 'b' ? 'Black to play' : 'White to play';
  const eventLabel = gameData?.meta.event || gameData?.meta.year || 'Async chess preview';

  return (
    <div className="flex relative flex-col justify-center items-center min-h-screen w-full bg-white dark:bg-gray-950 text-slate-900 dark:text-slate-100 p-3 sm:p-6 overflow-hidden select-none">
      
      {/* Main card - Changed from h-screen constraint to let it grow dynamically to fit the square aspect ratio */}
      <div className="w-full max-w-sm flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-xl shadow-slate-200/30 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/10">
        
        {/* Match Details */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div>
            <div className="text-[10px] sm:text-xs uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">Match</div>
            <div className="mt-0.5 text-base font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[150px] sm:max-w-xs">
              {whiteName} vs {blackName}
            </div>
          </div>
          <div className="rounded-xl bg-slate-200 px-2 py-0.5 text-[10px] sm:text-xs font-semibold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300 whitespace-nowrap">
            {loading ? 'Loading…' : turnLabel}
          </div>
        </div>

        {/* Chessboard Container - Added grid-rows-8 to enforce the 8th row explicitly inside the grid */}
        <div className="w-full aspect-square rounded-xl overflow-hidden border border-slate-300 dark:border-slate-700 mb-3">
          <div className="grid grid-cols-8 grid-rows-8 gap-0 w-full h-full">
            {board.map((piece, index) => {
              const row = Math.floor(index / 8);
              const col = index % 8;
              const isDark = (row + col) % 2 === 1;
              const backgroundColor = isDark ? '#986B41' : '#FFFDD0';

              return (
                <div 
                  key={index} 
                  className="flex items-center justify-center relative w-full h-full"
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
        </div>

        {/* Action / Event Section */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Event</div>
            <div className="mt-0.5 text-xs text-slate-700 dark:text-slate-300 truncate">{eventLabel}</div>
          </div>
          <button
            className="rounded-full bg-[#d93900] px-4 py-2 text-xs sm:text-sm font-semibold text-white transition hover:bg-[#c23300] active:scale-95 shrink-0 shadow-sm"
            onClick={(e) => requestExpandedMode(e.nativeEvent, 'game')}
          >
            Play now
          </button>
        </div>
      </div>

    </div>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Splash />
  </StrictMode>
);