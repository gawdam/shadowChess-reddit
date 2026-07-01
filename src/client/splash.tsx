import './index.css';

import { navigateTo } from '@devvit/web/client';
import { context, requestExpandedMode } from '@devvit/web/client';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { useCounter } from './hooks/useCounter';

const parseFEN = (fen: string | undefined): (string | null)[] => {
  const normalized = fen?.trim() ?? '';
  const rows = normalized.split(' ')[0].split('/');
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
    <div className="flex relative flex-col justify-center items-center min-h-screen gap-6 bg-white dark:bg-gray-950 text-slate-900 dark:text-slate-100 px-4 py-8">
      <div className="flex flex-col items-center gap-3 text-center max-w-xl">
        <img
          className="object-contain w-28 h-28"
          src="/snoo.png"
          alt="Snoo"
        />
        <h1 className="text-3xl font-black tracking-tight">
          {displayName}, your board is ready.
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          This match is assigned for the post and will load the same opening for every player.
        </p>
      </div>

      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-slate-50 p-4 shadow-xl shadow-slate-200/30 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/10">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <div className="text-sm uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">Match</div>
            <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{whiteName} vs {blackName}</div>
          </div>
          <div className="rounded-2xl bg-slate-200 px-3 py-1 text-xs font-semibold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {loading ? 'Loading…' : turnLabel}
          </div>
        </div>
        <div className="grid grid-cols-8 gap-[1px] rounded-xl overflow-hidden border border-slate-300 bg-slate-300 dark:border-slate-700 dark:bg-slate-700">
          {board.map((piece, index) => {
            const row = Math.floor(index / 8);
            const col = index % 8;
            const isDark = (row + col) % 2 === 1;
            const squareColor = isDark ? 'bg-slate-700' : 'bg-slate-100 dark:bg-slate-800';
            return (
              <div key={index} className={`${squareColor} h-10 w-10 flex items-center justify-center`}>
                {piece && (
                  <img src={`/pieces/${piece}.png`} alt={piece} className="h-8 w-8 object-contain" />
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Event</div>
            <div className="mt-1 text-sm text-slate-700 dark:text-slate-300">{eventLabel}</div>
          </div>
          <button
            className="rounded-full bg-[#d93900] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#c23300]"
            onClick={(e) => requestExpandedMode(e.nativeEvent, 'game')}
          >
            Play now
          </button>
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-center gap-3 text-xs text-slate-500 dark:text-slate-400">
        <button
          className="cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors"
          onClick={() => navigateTo('https://developers.reddit.com/docs')}
        >
          Docs
        </button>
        <span className="text-slate-300 dark:text-slate-600">|</span>
        <button
          className="cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors"
          onClick={() => navigateTo('https://www.reddit.com/r/Devvit')}
        >
          r/Devvit
        </button>
        <span className="text-slate-300 dark:text-slate-600">|</span>
        <button
          className="cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors"
          onClick={() => navigateTo('https://discord.com/invite/R7yu2wh9Qz')}
        >
          Discord
        </button>
      </footer>
    </div>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Splash />
  </StrictMode>
);
