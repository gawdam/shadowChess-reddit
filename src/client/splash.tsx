import './index.css';

import { requestExpandedMode } from '@devvit/web/client';
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useCounter } from './hooks/useCounter';
import { HowToPlayDialog } from './howToPlayDialog';

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
  const [submittedView, setSubmittedView] = useState<'scorecard' | 'leaderboard'>('scorecard');
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const board = gameData ? parseFEN(gameData.fen) : Array(64).fill(null);
  const showBoardLoader = loading || !pieceAssetsReady || !gameData;
  const closesAt = gameData?.closesAt ?? null;
  const remainingMs = closesAt ? Math.max(0, closesAt - now) : 0;
  const isGameClosed = Boolean(closesAt && remainingMs <= 0);
  const remainingHours = Math.floor(remainingMs / (60 * 60 * 1000));
  const remainingMinutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
  const countdownLabel = remainingHours > 0 
  ? `${remainingHours} hour${remainingHours === 1 ? '' : 's'}` 
  : `${remainingMinutes} min${remainingMinutes === 1 ? '' : 's'}`;
  const whiteStats = simulationStats.white;
  const blackStats = simulationStats.black;
  const whiteGameLabel = (gameData?.meta?.white)?.split(',')[0]?.trim() ?? 'White';
  const blackGameLabel = (gameData?.meta?.black)?.split(',')[0]?.trim() ?? 'Black';
  const isUserWhiteSide = userData.userSide === 'white';
  const isUserBlackSide = userData.userSide === 'black';
  const userTeamLabel = isUserWhiteSide ? 'White' : 'Black';
  const whiteGames = playerCounts?.white ?? whiteStats.players ?? 0;
  const blackGames = playerCounts?.black ?? blackStats.players ?? 0;
  const averageDenominator = whiteGames * blackGames;
  const getAverageValue = (value: number) => (averageDenominator > 0 ? value / averageDenominator : 0);
  const formatAverage = (value: number) => getAverageValue(value).toFixed(2);
  const whiteAverageScore = getAverageValue(whiteStats.totalScore);
  const blackAverageScore = getAverageValue(blackStats.totalScore);
  const isWhiteLeading = whiteAverageScore > blackAverageScore;
  const isBlackLeading = blackAverageScore > whiteAverageScore;
  const userTeamAverageScore = isUserWhiteSide ? whiteAverageScore : blackAverageScore;
  const userTeamLeadingState = (isUserWhiteSide && isWhiteLeading) || (isUserBlackSide && isBlackLeading) ? 'leading' : 'trailing';

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
              <span className="text-[10px] font-black text-black mb-0.5">{formatAverage(entry.score)}</span>
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
      <div
        className="flex flex-col items-center justify-center h-screen w-full bg-[#FFFDF5] text-black p-2 select-none font-sans overflow-hidden text-[11px] sm:text-xs md:text-sm"
        style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '24px 24px' }}
      >
        <HowToPlayDialog open={showHowToPlay} onClose={() => setShowHowToPlay(false)} />
        <div className="w-full max-w-5xl max-h-[94vh] bg-white border-4 border-black rounded-none p-2 shadow-[8px_8px_0px_0px_#000] flex flex-col gap-2 overflow-hidden">
          <div className="text-center border-b-2 border-black pb-1 relative">
            <div className="flex items-center justify-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black tracking-tighter uppercase text-black rotate-[-0.5deg] inline-block bg-[#FFD93D] px-3 py-0.5 border-4 border-black shadow-[4px_4px_0px_0px_#000]">
                ShadowChess
              </h1>
              <button
                type="button"
                aria-label="How to play"
                onClick={() => setShowHowToPlay(true)}
                className="w-8 h-8 border-4 border-black rounded-none bg-white text-black font-black text-sm leading-none shadow-[3px_3px_0px_0px_#000] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
              >
                ?
              </button>
            </div>
            <p className="text-[9px] tracking-widest uppercase font-bold text-black mt-1">Game Over • Performance Summary</p>
          </div>

          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setSubmittedView('scorecard')}
              className={`rounded-none border-4 border-black px-3 py-1 text-[10px] font-black tracking-wide shadow-[3px_3px_0px_0px_#000] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none ${submittedView === 'scorecard' ? 'bg-[#FFD93D] text-black' : 'bg-white text-black'}`}
            >
              Scorecard
            </button>
            <button
              type="button"
              onClick={() => setSubmittedView('leaderboard')}
              className={`rounded-none border-4 border-black px-3 py-1 text-[10px] font-black tracking-wide shadow-[3px_3px_0px_0px_#000] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none ${submittedView === 'leaderboard' ? 'bg-[#FFD93D] text-black' : 'bg-white text-black'}`}
            >
              Leaderboard
            </button>
          </div>

          {submittedView === 'scorecard' ? (
            <div className="w-full flex items-center justify-center">
              <div className="w-full max-w-[620px]">
                <div
                  style={{
                    width: '100%',
                    background: '#FFFFFF',
                    border: '4px solid #000000',
                    borderRadius: 0,
                    boxShadow: '4px 4px 0px 0px #000000',
                    fontFamily: 'system-ui, sans-serif',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', alignItems: 'stretch' }}>
                    <div style={{ background: '#FFD93D', color: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '8px', gap: '4px' }}>
                      <div style={{ position: 'relative', width: '54px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {isWhiteLeading && (
                          <img
                            src="/crown.png"
                            alt="Leading side crown"
                            style={{
                              width: '54px',
                              height: '54px',
                              objectFit: 'contain',
                              position: 'absolute',
                              left: '50%',
                              top: '-16px',
                              transform: 'translateX(-50%)',
                              pointerEvents: 'none',
                            }}
                          />
                        )}
                        <img src="/pieces/white_king.png" alt="White king" style={{ width: '40px', height: '40px', objectFit: 'contain', position: 'relative', zIndex: 1 }} />
                      </div>
                      <div style={{ fontSize: '9px', fontWeight: 900, textAlign: 'center', lineHeight: 1.2, wordBreak: 'break-word' }}>{whiteGameLabel}</div>
                    </div>

                    <div style={{ background: '#FFFFFF', color: '#000000', display: 'flex', flexDirection: 'column', borderLeft: '4px solid #000', borderRight: '4px solid #000' }}>
                      <div style={{ padding: '8px 10px', textAlign: 'center', fontSize: '11px', fontWeight: 900, color: '#000000', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '4px solid #000' }}>
                        {userTeamLabel} (you) is {userTeamLeadingState}
                      </div>
                      <div style={{ padding: '8px 8px', alignItems: 'center' }}>
                        <div style={{ textAlign: 'center', fontSize: '28px', fontWeight: 900 }}>{userTeamAverageScore.toFixed(2)}</div>
                      </div>
                    </div>

                    <div style={{ background: '#C4B5FD', color: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '8px', gap: '4px' }}>
                      <div style={{ position: 'relative', width: '54px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {isBlackLeading && (
                          <img
                            src="/crown.png"
                            alt="Leading side crown"
                            style={{
                              width: '54px',
                              height: '54px',
                              objectFit: 'contain',
                              position: 'absolute',
                              left: '50%',
                              top: '-16px',
                              transform: 'translateX(-50%)',
                              pointerEvents: 'none',
                            }}
                          />
                        )}
                        <img src="/pieces/black_king.png" alt="Black king" style={{ width: '40px', height: '40px', objectFit: 'contain', position: 'relative', zIndex: 1 }} />
                      </div>
                      <div style={{ fontSize: '9px', fontWeight: 900, textAlign: 'center', lineHeight: 1.2, wordBreak: 'break-word' }}>{blackGameLabel}</div>
                    </div>
                  </div>

                  <div style={{ background: '#FFFDF5', color: '#000000', fontSize: '14px', borderTop: '4px solid #000' }}>
                    {[
                      { label: 'Players', white: whiteGames, black: blackGames },
                      { label: 'Illegal moves / game', white: formatAverage(whiteStats.illegalMoves), black: formatAverage(blackStats.illegalMoves) },
                      { label: 'Captures / game', white: formatAverage(whiteStats.captures), black: formatAverage(blackStats.captures) },
                    ].map((stat, i) => (
                      <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1fr', alignItems: 'center', textAlign: 'center', borderTop: '4px solid #000' }}>
                        <div style={{ padding: '6px 8px', fontSize: '12px', fontWeight: 900, color: '#000' }}>{stat.white}</div>
                        <div
                          style={{
                            padding: '6px 8px',
                            background: stat.label === 'Players' ? '#FFD93D' : (stat.label.startsWith('Illegal moves') ? '#FF6B6B' : '#C4B5FD'),
                            color: '#000000',
                            fontWeight: 900,
                            letterSpacing: '0.4px',
                            fontSize: '10px',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderLeft: '4px solid #000000',
                            borderRight: '4px solid #000000',
                          }}
                        >
                          {stat.label}
                        </div>
                        <div style={{ padding: '6px 8px', fontSize: '12px', fontWeight: 900, color: '#000' }}>{stat.black}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ background: '#FFD93D', padding: '8px', borderTop: '4px solid #000000', textAlign: 'center', marginTop: 'auto', borderRadius: 0 }}>
                    <div style={{ color: '#000000', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '4px' }}>
                      Your Score
                    </div>
                    <div style={{ color: '#000000', fontSize: '22px', fontWeight: 900 }}>{formatAverage(userData.score ?? 0)}</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="w-full max-w-[780px] grid grid-cols-2 gap-2">
              <div className="border-4 border-black rounded-none bg-white p-1.5 shadow-[4px_4px_0px_0px_#000] flex flex-col justify-between">
                <div className="text-[9px] font-bold text-center bg-black text-white py-0.5">Leaderboard (White)</div>
                {renderNeoPodium(leaderboards.white.top, 'No scores recorded')}
              </div>
              <div className="border-4 border-black rounded-none bg-white p-1.5 shadow-[4px_4px_0px_0px_#000] flex flex-col justify-between">
                <div className="text-[9px] font-bold text-center bg-black text-white py-0.5">Leaderboard (Black)</div>
                {renderNeoPodium(leaderboards.black.top, 'No scores recorded')}
              </div>
            </div>
          )}

          <div className="flex justify-center mt-0.5">
            <div className="w-full max-w-[620px]">
              <button
                className="w-full py-2 px-4 rounded-none bg-[#FF6B6B] border-4 border-black text-[11px] sm:text-xs font-bold text-black tracking-wide shadow-[4px_4px_0px_0px_#000] transition-all duration-100 active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
                onClick={(e) => requestExpandedMode(e.nativeEvent, 'game')}
              >
                View my game board
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col justify-center items-center h-screen w-full bg-[#FFFDF5] text-black p-2 select-none font-sans overflow-hidden"
         style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
      <HowToPlayDialog open={showHowToPlay} onClose={() => setShowHowToPlay(false)} />
      
      <div className="w-full max-w-sm flex flex-col justify-between rounded-none border-4 border-black bg-white p-4 shadow-[8px_8px_0px_0px_#000]">
        
        <div className="text-center mb-3">
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-3xl font-black tracking-tighter uppercase text-black bg-[#FFD93D] px-3 py-1 border-4 border-black shadow-[4px_4px_0px_0px_#000] inline-block rotate-[1deg]">
              ShadowChess
            </h1>
            <button
              type="button"
              aria-label="How to play"
              onClick={() => setShowHowToPlay(true)}
              className="w-8 h-8 border-4 border-black rounded-none bg-white text-black font-black text-sm leading-none shadow-[3px_3px_0px_0px_#000] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
            >
              ?
            </button>
          </div>
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