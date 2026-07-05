import './index.css';

import React, { StrictMode, useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { useCounter } from './hooks/useCounter';



const Chessboard = () => {
  // responsive square size for mobile
  const [square, setSquare] = useState<number>(() => {
    if (typeof window === 'undefined') return 60;
    const max = 60;
    const computed = Math.floor((window.innerWidth - 40) / 8);
    return Math.max(30, Math.min(max, computed));
  });

  React.useEffect(() => {
    const onResize = () => {
      const max = 60;
      const computed = Math.floor((window.innerWidth - 40) / 8);
      setSquare(Math.max(30, Math.min(max, computed)));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const boardSize = square * 8;

    const majorOrder = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];

    const getInitialPiece = (row: number, col: number): string | null => {
      // row 0 = top (black major pieces), row 1 = black pawns
      if (row === 0) return `black_${majorOrder[col]}`;
      if (row === 1) return 'black_pawn';
      if (row === 6) return 'white_pawn';
      if (row === 7) return `white_${majorOrder[col]}`;
      return null;
    };



    const appStyle: React.CSSProperties = {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      width: '100%',
      padding: 18,
      background: '#f4efe4',
      color: '#000000',
      boxSizing: 'border-box',
      position: 'relative',
    };


    const badgeStyle = (color: string): React.CSSProperties => ({
      width: 12,
      height: 12,
      borderRadius: 3,
      background: color,
      border: color === '#fff' ? '1px solid #aaa' : '1px solid #333',
    });


    // initialize board from getInitialPiece
    const initialBoard = Array.from({ length: 64 }).map((_, i) =>
      getInitialPiece(Math.floor(i / 8), i % 8)
    );

    const [board, setBoard] = useState<(string | null)[]>(initialBoard);
    const [selected, setSelected] = useState<number | null>(null);
    const [legalMoves, setLegalMoves] = useState<number[]>([]);
    const [dragging, setDragging] = useState<number | null>(null);
    const [ghost, setGhost] = useState<{ piece: string; x: number; y: number; scale?: number } | null>(null);
    const [targetIndex, setTargetIndex] = useState<number | null>(null);
    const [capturedByWhite, setCapturedByWhite] = useState<string[]>([]);
    const [capturedByBlack, setCapturedByBlack] = useState<string[]>([]);
    const [moves, setMoves] = useState<{ notation: string; color: 'w' | 'b' }[]>([]);
    const handleOnClick = async () => {
      const notations = moves.map(m => m.notation);
      
      if (notations.length !== 5) {
        alert(`Please finish your moves first (${notations.length}/5)`);
        return;
      }

      const success = await submitMoves(notations);
      if (success) {
        // Optional: add UI reset logic here (e.g., clear client board moves)
      }
    };
        // Side Selection & Count Tracking



    const touchFromRef = useRef<number | null>(null);
    const touchLastTargetRef = useRef<number | null>(null);
    const touchTapStartRef = useRef<{ idx: number; x: number; y: number; t: number } | null>(null);

    // Audio refs — put your mp3s in public/sounds/move.mp3 and public/sounds/capture.mp3
    const moveAudioRef = useRef<HTMLAudioElement>(new Audio('/sounds/move-self.mp3'));
    const captureAudioRef = useRef<HTMLAudioElement>(new Audio('/sounds/capture.mp3'));

    
    const handleMove = (from: number, to: number) => {
      if (from === to) return;
      const piece = board[from];
      if (!piece) return;
      // clear ghost immediately to avoid visual overlap during move
      setGhost(null);
      setTargetIndex(null);
      setDragging(null);
      const newBoard = board.slice();
      const destPiece = newBoard[to];
      newBoard[to] = piece;
      newBoard[from] = null;
      setBoard(newBoard);
      setSelected(null);

      // Record move ledger entry
      const kind = piece.split('_')[1];
      const pieceColor = piece.startsWith('white_') ? 'w' : 'b';
      const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
      const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
      const toSquare = files![to % 8]! + ranks[Math.floor(to / 8)];
      const moveNotation = (kind === 'pawn' ? '' : kind === 'knight' ? 'N' : kind![0]!.toUpperCase()) + toSquare;
      setMoves((prev) => [...prev, { notation: moveNotation, color: pieceColor }]);

      try {
        if (destPiece) {
          if (piece.startsWith('white_')) {
            setCapturedByWhite((prev) => [...prev, destPiece]);
          } else {
            setCapturedByBlack((prev) => [...prev, destPiece]);
          }
          captureAudioRef.current.currentTime = 0;
          void captureAudioRef.current.play();
        } else {
          moveAudioRef.current.currentTime = 0;
          void moveAudioRef.current.play();
        }
      } catch (e) {
        // ignore playback errors
      }
    };

    // --- Move generation: simple legal move calculator (no check detection) ---
    const getLegalMoves = (boardState: (string | null)[], from: number): number[] => {
      const piece = boardState[from];
      if (!piece) return [];
      const color = piece.startsWith('white_') ? 'w' : 'b';
      const moves: number[] = [];
      const r0 = Math.floor(from / 8);
      const c0 = from % 8;

      const inBounds = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;
      const idx = (r: number, c: number) => r * 8 + c;

      // add the square and ALWAYS continue sliding (no blocking)
      const tryAdd = (r: number, c: number) => {
        if (!inBounds(r, c)) return false;
        moves.push(idx(r, c));
        return true; // always continue sliding regardless of occupancy
      };

      const kind = piece.split('_')[1];
      if (kind === 'rook' || kind === 'queen') {
        // orthogonal
        const dirs: Array<[number, number]> = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (const [dr, dc] of dirs) {
          let r = r0 + dr, c = c0 + dc;
          while (inBounds(r, c)) {
            if (!tryAdd(r, c)) break;
            r += dr; c += dc;
          }
        }
      }
      if (kind === 'bishop' || kind === 'queen') {
        const dirs: Array<[number, number]> = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
        for (const [dr, dc] of dirs) {
          let r = r0 + dr, c = c0 + dc;
          while (inBounds(r, c)) {
            if (!tryAdd(r, c)) break;
            r += dr; c += dc;
          }
        }
      }
      if (kind === 'knight') {
        const deltas: Array<[number, number]> = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
        for (const [dr, dc] of deltas) {
          const r = r0 + dr, c = c0 + dc;
          if (!inBounds(r, c)) continue;
          const t = boardState[idx(r, c)];
          if (!t) moves.push(idx(r, c));
        }
      }
      if (kind === 'king') {
        for (let dr=-1; dr<=1; dr++) for (let dc=-1; dc<=1; dc++) {
          if (dr===0 && dc===0) continue;
          const r = r0+dr, c = c0+dc;
          if (!inBounds(r,c)) continue;
          const t = boardState[idx(r,c)];
          if (!t) moves.push(idx(r,c));
        }
      }
      if (kind === 'pawn') {
        // pawns move forward (white moves up (r-1), black moves down (r+1))
        const dir = color === 'w' ? -1 : 1;
        const oneR = r0 + dir;
        // forward one (ignore blocking)
        if (inBounds(oneR, c0)) moves.push(idx(oneR, c0));
        // forward two from starting rank (ignore blocking)
        const startRank = color === 'w' ? 6 : 1;
        const twoR = r0 + dir*2;
        if (r0 === startRank && inBounds(twoR, c0)) moves.push(idx(twoR, c0));
        // captures: allow diagonal captures even if empty, and allow self-capture
        for (const dc of [-1, 1]) {
          const cr = r0 + dir, cc = c0 + dc;
          if (!inBounds(cr, cc)) continue;
          // allow capture regardless of whether a piece exists
          moves.push(idx(cr, cc));
        }
      }

      return moves;
    };

    // parse only the placement + active color fields we need
    const parseFEN = (fen: string): { board: (string | null)[]; turn: 'w' | 'b' | null } => {
      const parts = fen.trim().split(/\s+/);
      const placement = parts[0] || '';
      const active = parts[1] || 'w';
      const rows = placement.split('/');
      const boardArr: (string | null)[] = Array(64).fill(null);
      for (let r = 0; r < 8; r++) {
        const row = rows[r] || '';
        let file = 0;
        for (const ch of row) {
          if (/\d/.test(ch)) {
            file += Number(ch);
          } else {
            const mapping: Record<string, string> = {
              P: 'white_pawn', N: 'white_knight', B: 'white_bishop', R: 'white_rook', Q: 'white_queen', K: 'white_king',
              p: 'black_pawn', n: 'black_knight', b: 'black_bishop', r: 'black_rook', q: 'black_queen', k: 'black_king',
            };
            boardArr[r * 8 + file] = mapping[ch] ?? null;
            file++;
          }
        }
      }
      return { board: boardArr, turn: active === 'b' ? 'b' : 'w' };
    };

    const [gameMeta, setGameMeta] = useState<{
      white?: string;
      black?: string;
      year?: string;
      event?: string;
      date?: string;
      site?: string;
      round?: string;
      white_elo?: string;
      black_elo?: string;
      eco?: string;
      result?: string;
      turn?: string;
    } | null>({ turn: 'w' });


    const gameTitle = `${gameMeta?.white?.split(',')[0] ?? 'White'} vs ${gameMeta?.black?.split(',')[0] ?? 'Black'}`;
    const gameSubtitle = gameMeta?.event || (gameMeta?.year ? `${gameMeta.year} Chess championship` : 'Chess championship');
    const titleText = `${gameTitle}`;

    const { username, gameData, selectSide, playerCounts, userSide , submitMoves, submitting } = useCounter();

    const boardStyle: React.CSSProperties = {
      border: '4px solid rgba(255,255,255,0.08)',
      boxShadow: '0 0 40px rgba(0,0,0,0.45)',
      display: 'grid',
      gridTemplateColumns: `repeat(8, ${square}px)`,
      width: boardSize,
      height: boardSize,
      boxSizing: 'content-box',
      touchAction: 'none',
      background: '#e6e0d5',
      transform: userSide === 'black' ? 'rotate(180deg)' : undefined,
    };

    React.useEffect(() => {
      if (!gameData) return;
      const parsed = parseFEN(gameData.fen);
      setBoard(parsed.board);
      setSelected(null);
      setDragging(null);
      setGhost(null);
      setTargetIndex(null);
      setCapturedByWhite([]);
      setCapturedByBlack([]);
      setMoves([]);
      setGameMeta({ ...gameData.meta, turn: gameData.turn });
    }, [gameData]);

    // update legal moves when selection or board changes
    React.useEffect(() => {
      if (selected === null) {
        setLegalMoves([]);
        return;
      }
      setLegalMoves(getLegalMoves(board, selected));
    }, [selected, board]);

    // helper: enforce turn-based selection/movement
    const isPieceMovable = (piece?: string | null) => {
      if (!piece) return false;
      if (userSide === 'black') return piece.startsWith('black_');
      if (userSide === 'white') return piece.startsWith('white_');
      return false;
    };

    const onSquareClick = (idx: number) => {
      const piece = board[idx];
      if (selected === null) {
        if (!piece) return;
        if (!isPieceMovable(piece)) return;
        setSelected(idx);
        return;
      }
      if (selected === idx) {
        setSelected(null);
        setLegalMoves([]);
        return;
      }
      // only allow move if legal
      if (legalMoves.includes(idx) && selected !== null) {
        handleMove(selected, idx);
        setLegalMoves([]);
        return;
      }
      // clicked another piece: if same color, change selection
      const selPiece = board[selected];
      if (piece && selPiece) {
        const selColor = selPiece.startsWith('white_') ? 'w' : 'b';
        const pColor = piece.startsWith('white_') ? 'w' : 'b';
        if (selColor === pColor) {
          // only allow changing selection to a piece that's movable given the turn
          if (isPieceMovable(piece)) {
            setSelected(idx);
            return;
          }
        }
      }
      // otherwise clear selection
      setSelected(null);
      setLegalMoves([]);
    };

    // helper to set grabbed cursor ('grabbing' while dragging)
    const setGrabCursor = (grab: boolean) => {
      try {
        document.body.style.cursor = grab ? 'grabbing' : '';
      } catch {}
    };

    const onTouchStart = (e: React.TouchEvent<HTMLImageElement>, idx: number) => {
      e.preventDefault();
      const t = e.touches && e.touches[0];
      const x = t ? t.clientX : 0;
      const y = t ? t.clientY - Math.floor(square * 0.35) : 0;
      touchFromRef.current = idx;
      touchLastTargetRef.current = idx;
      const piece = board[idx];
      // guard: only start drag if piece is allowed to move this turn
      if (!isPieceMovable(piece)) return;
      setDragging(idx);
      // on mobile/touch: render ghost at 2x size for clearer dragging
      if (piece) setGhost({ piece, x, y, scale: 2 });
      setGrabCursor(true);
    };

    const onSquareTouchStart = (e: React.TouchEvent, idx: number) => {
      // record tap start for this square (used for point-and-click)
      const t = e.touches && e.touches[0];
      const x = t ? t.clientX : 0;
      const y = t ? t.clientY : 0;
      touchTapStartRef.current = { idx, x, y, t: Date.now() };
      // do not preventDefault here so drag can still start on image; we only intercept taps on end
    };

    const onTouchMove = (e: React.TouchEvent) => {
      e.preventDefault();
      const t = e.touches && e.touches[0];
      if (!t) return;
      const x = t.clientX;
      // place ghost slightly above finger (offset by 25% of square)
      const y = t.clientY - Math.floor(square * 0.35);
      if (ghost) setGhost({ piece: ghost.piece, x, y, scale: ghost.scale ?? 2 });
      const el = document.elementFromPoint(t.clientX, t.clientY) as HTMLElement | null;
      const squareEl = el?.closest('[data-index]') as HTMLElement | null;
      if (squareEl) {
        const idx = Number(squareEl.dataset.index);
        if (!Number.isNaN(idx)) {
          touchLastTargetRef.current = idx;
          setTargetIndex(idx);
        }
      } else {
        setTargetIndex(null);
      }
    };

    const onTouchEnd = (e: React.TouchEvent) => {
      e.preventDefault();
      const t = e.changedTouches && e.changedTouches[0];
      const endX = t ? t.clientX : 0;
      const endY = t ? t.clientY : 0;

      // detect tap
      const tap = touchTapStartRef.current;
      if (tap) {
        const dt = Date.now() - tap.t;
        const dx = Math.abs((tap.x || 0) - endX);
        const dy = Math.abs((tap.y || 0) - endY);
        const moved = Math.sqrt(dx * dx + dy * dy);
        const isTap = dt < 300 && moved < 12;
        if (isTap) {
          const el = document.elementFromPoint(endX, endY) as HTMLElement | null;
          const squareEl = el?.closest('[data-index]') as HTMLElement | null;
          const toIdx = squareEl ? Number(squareEl.dataset.index) : null;
          // perform tap behavior: select or move
          if (toIdx !== null && !Number.isNaN(toIdx)) {
            if (selected === null) {
              // select piece if present and allowed this turn
              if (board[toIdx] && isPieceMovable(board[toIdx])) setSelected(toIdx);
            } else {
              if (selected === toIdx) {
                setSelected(null);
                setLegalMoves([]);
              } else if (legalMoves.includes(toIdx) && selected !== null) {
                handleMove(selected, toIdx);
                setLegalMoves([]);
              } else if (board[toIdx]) {
                // select other piece of same color
                const selPiece = board[selected];
                if (selPiece) {
                  const selColor = selPiece.startsWith('white_') ? 'w' : 'b';
                  const pColor = board[toIdx]!.startsWith('white_') ? 'w' : 'b';
                    if (selColor === pColor && isPieceMovable(board[toIdx])) setSelected(toIdx);
                  else setSelected(null);
                }
              } else {
                setSelected(null);
              }
            }
            touchTapStartRef.current = null;
            return;
          }
        }
        touchTapStartRef.current = null;
      }

      // otherwise treat as drag end
      const from = touchFromRef.current;
      const to = touchLastTargetRef.current;
      if (from !== null && to !== null && from !== to) {
        // ensure piece at `from` is allowed to move this turn
        const piece = board[from];
        if (isPieceMovable(piece)) {
          const legal = getLegalMoves(board, from);
          if (legal.includes(to)) handleMove(from, to);
        }
      }
      touchFromRef.current = null;
      touchLastTargetRef.current = null;
      setDragging(null);
      setGhost(null);
      setGrabCursor(false);
      setTargetIndex(null);
    };

    const onBoardDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      const x = e.clientX;
      const y = e.clientY - Math.floor(square * 0.35);
      if (ghost) setGhost({ piece: ghost.piece, x, y, scale: ghost.scale ?? 1.15 });
      console.debug('onBoardDragOver', { x, y });
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const squareEl = el?.closest('[data-index]') as HTMLElement | null;
      if (squareEl) {
        const idx = Number(squareEl.dataset.index);
        if (!Number.isNaN(idx)) setTargetIndex(idx);
      } else {
        setTargetIndex(null);
      }
      try { e.dataTransfer.dropEffect = 'move'; } catch {}
    };

    const onBoardDrop = (e: React.DragEvent) => {
      e.preventDefault();
      const from = Number(e.dataTransfer.getData('text/plain'));
      console.debug('onBoardDrop', { from, clientX: e.clientX, clientY: e.clientY });
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const squareEl = el?.closest('[data-index]') as HTMLElement | null;
      const to = squareEl ? Number(squareEl.dataset.index) : null;
      if (!Number.isNaN(from) && to !== null && !Number.isNaN(to)) {
        // ensure the piece being dragged is allowed to move this turn
        const piece = board[from];
        if (!isPieceMovable(piece)) return;
        const legal = getLegalMoves(board, from);
        if (legal.includes(to)) handleMove(from, to);
      }
      setDragging(null);
      setGhost(null);
      setGrabCursor(false);
      setTargetIndex(null);
    };

    const boardRef = useRef<HTMLDivElement | null>(null);

    // Click/touch outside the board should clear selection
    const onOutsidePointerDown = (e: any) => {
      const tgt = (e.target as HTMLElement) || null;
      if (!boardRef.current || !tgt) return;
      if (!boardRef.current.contains(tgt)) {
        setSelected(null);
        setLegalMoves([]);
      }
    };

    // Desktop mouse fallback for drag (works even if native drag events are unreliable)
    React.useEffect(() => {
      let fromIndex: number | null = null;
      const onMouseMove = (e: MouseEvent) => {
        if (fromIndex === null) return;
        const x = e.clientX;
        const y = e.clientY - Math.floor(square * 0.35);
        setGhost((g) => (g ? { piece: g.piece, x, y, scale: g.scale ?? 1.15 } : g));
        console.debug('mouseMove ghost update', { fromIndex, x, y });
        const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
        const squareEl = el?.closest('[data-index]') as HTMLElement | null;
        if (squareEl) {
          const idx = Number(squareEl.dataset.index);
          if (!Number.isNaN(idx)) setTargetIndex(idx);
        } else setTargetIndex(null);
      };
      const onMouseUp = (e: MouseEvent) => {
        if (fromIndex === null) return;
        const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
        const squareEl = el?.closest('[data-index]') as HTMLElement | null;
        const to = squareEl ? Number(squareEl.dataset.index) : null;
        if (!Number.isNaN(fromIndex) && to !== null && !Number.isNaN(to)) {
          const legal = getLegalMoves(board, fromIndex);
          if (legal.includes(to)) handleMove(fromIndex, to);
        }
        fromIndex = null;
        setDragging(null);
        setGhost(null);
        setGrabCursor(false);
        setTargetIndex(null);
        console.debug('mouseUp', { to });
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      const onImgMouseDown = (e: MouseEvent) => {
        const target = e.target as HTMLElement | null;
        const squareEl = target?.closest('[data-index]') as HTMLElement | null;
        if (!squareEl) return;
        const idx = Number(squareEl.dataset.index);
        if (Number.isNaN(idx)) return;
        const piece = board[idx];
        if (!piece) return;
        // guard: only allow dragging pieces that are movable this turn
        if (!isPieceMovable(piece)) return;
        fromIndex = idx;
        setDragging(idx);
        // mouse/desktop ghost slightly larger than square
        setGhost({ piece, x: e.clientX, y: e.clientY - Math.floor(square * 0.25), scale: 1.15 });
        console.debug('mouseDown start drag', { fromIndex });
        setGrabCursor(true);
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      };

      // attach listener to board container (use ref for reliability)
      const boardEl = boardRef.current;
      boardEl?.addEventListener('mousedown', onImgMouseDown as any);
      return () => {
        boardEl?.removeEventListener('mousedown', onImgMouseDown as any);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };
    }, [board, square]);

    const isBlackLeft = gameMeta?.turn === 'b';
    const leftHeader = isBlackLeft ? 'Black' : 'White';
    const rightHeader = isBlackLeft ? 'White' : 'Black';

    if (!userSide) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', background: '#f4efe4', fontFamily: 'sans-serif', padding: 20
      }}>
        <div style={{
          background: '#fff', padding: '32px', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
          maxWidth: '440px', width: '100%', textAlign: 'center'
        }}>
          <h2 style={{ margin: '0 0 8px 0', color: '#262421' }}>Choose Your Side</h2>
          <p style={{ color: '#706e6b', fontSize: '14px', marginBottom: '24px' }}>Join a faction to play your moves!</p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button 
              onClick={() => { selectSide('white');}}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '16px', background: '#ffffff', border: '2px solid #e1e1e1', borderRadius: '8px',
                cursor: 'pointer', fontSize: '16px', fontWeight: 600, color: '#262421'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={badgeStyle('#ffffff')} />
                <span>White ({gameMeta?.white})</span>
              </div>
              <span style={{ fontSize: '13px', color: '#706e6b' }}>{playerCounts?.white || 0} Players</span>
            </button>

            <button 
              onClick={() => {selectSide('black');}}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '16px', background: '#262421', border: '2px solid #262421', borderRadius: '8px',
                cursor: 'pointer', fontSize: '16px', fontWeight: 600, color: '#ffffff'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={badgeStyle('#000000')} />
                <span>Black ({gameMeta?.black})</span>
              </div>
              <span style={{ fontSize: '13px', color: '#bababa' }}>{playerCounts?.black || 0} Players</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

return (
  <div
    style={{
      ...appStyle,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      backgroundColor: '#161512', // Set dark application background
      color: '#bababa', // Adjusted general text color to light gray
      padding: '16px',
      maxWidth: '1000px',
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '16px',
      boxSizing: 'border-box',
      width: '100%',
    }}
    onMouseDown={onOutsidePointerDown}
    onTouchStart={onOutsidePointerDown}
    onTouchMove={onTouchMove}
    onTouchEnd={onTouchEnd}
  >
    {/* ================= HEADER SECTION (STAYS ON TOP) ================= */}
    <div style={{ textAlign: 'center', width: '100%', marginBottom: '4px' }}>
      <h1 style={{ fontSize: 'min(6vw, 28px)', fontWeight: 800, letterSpacing: '-0.025em', color: '#fff', margin: '0 0 4px 0' }}>
        {titleText}
      </h1>
      <p style={{ fontSize: 'min(3.5vw, 14px)', color: '#989795', fontWeight: 500, margin: '0 0 12px 0' }}>
        {gameSubtitle} — <span style={{ color: '#81b64c', fontWeight: 700 }}>{gameMeta?.turn === 'b' ? "Black goes first" : "White goes first"}</span>
      </p>
    </div>

    {/* ================= THIN INLINE MOVE LEDGER (TOP OVERLAY) ================= */}
    <div style={{
      width: '100%',
      maxWidth: '1000px',
      background: '#211f1c',
      padding: '6px 16px',
      borderRadius: '6px',
      fontSize: '13px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      overflowX: 'auto',
      whiteSpace: 'nowrap',
      border: '1px solid rgba(255,255,255,0.05)',
      boxSizing: 'border-box',
      color: '#fff'
    }}>
      <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#989795', marginRight: '8px' }}>Moves:</span>
      
      {/* If no moves have been played yet, Black starts, and user is White -> display placeholder */}
      {(gameMeta?.turn === 'b' && userSide === 'white'|| gameMeta?.turn === 'w' && userSide === 'black') && (
        <span style={{ fontWeight: 800 }}><span style={{ color: '#706e6b' }}>1.</span> <span style={{ color: '#c01812' }}>?</span></span>
      )}

      {moves.map((m, idx) => {

        return (
          <div>
          <span key={idx} style={{ fontWeight: 500, marginRight: '6px' }}>
            <span style={{ color: '#706e6b' }}>{idx + 1}.</span> {m.notation}
          </span>
            {idx!==4 && (gameMeta?.turn === 'b' && userSide === 'white'|| gameMeta?.turn === 'w' && userSide === 'black')  &&(<span key={idx} style={{ fontWeight: 800, marginRight: '6px' }}>
              <span style={{ color: '#706e6b' }}>{idx + 2}.</span> <span style={{ color: '#c01812' }}>?</span>
            </span>)}
            {!(gameMeta?.turn === 'b' && userSide === 'white'|| gameMeta?.turn === 'w' && userSide === 'black')  &&(<span key={idx} style={{ fontWeight: 800, marginRight: '6px' }}>
            <span style={{ color: '#706e6b' }}>{idx + 1}.</span> <span style={{ color: '#c01812' }}>?</span>
          </span>)}
          </div>
        );
        
      })}
      
    </div>

    {/* ================= MAIN RESPONSIVE CONTAINER ================= */}
    <div style={{ 
      display: 'flex', 
      flexDirection: 'row', 
      flexWrap: 'wrap',
      gap: '16px', 
      width: '100%', 
      justifyContent: 'center',
      alignItems: 'flex-start'
    }}>
      
      {/* LEFT SIDE: BOARDS & PLAYERS */}
      <div style={{ 
        flex: '1 1 400px', 
        maxWidth: '500px', 
        width: '100%', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '8px' 
      }}>
        
        {/* BLOCK 1: OPPONENT/TOP PLAYER PANEL */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: '8px 12px', 
          background: '#262421', 
          borderRadius: '6px',
          border: '1px solid rgba(255,255,255,0.05)',
          fontSize: '14px',
          color: '#fff'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
            <div style={badgeStyle(userSide === 'white' ? '#000000' : '#ffffff')} />
            <span>ShadowChess GM</span>
            <span style={{ fontSize: '11px', color: '#989795', fontWeight: 400 }}>
              ({userSide === 'white' ? 'Black' : 'White'})
            </span>
          </div>
        </div>

        {/* BLOCK 2: RESPONSIVE CHESSBOARD */}
        <div 
          ref={boardRef} 
          style={{
            ...boardStyle,
            width: '100%',
            height: 'auto',
            aspectRatio: '1 / 1',
            display: 'grid',
            gridTemplateColumns: 'repeat(8, 1fr)',
            gridTemplateRows: 'repeat(8, 1fr)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            borderRadius: '4px',
            overflow: 'hidden'
          }} 
          onDragOver={onBoardDragOver} 
          onDrop={onBoardDrop}
        >
          {Array.from({ length: 64 }).map((_, i) => {
            const row = Math.floor(i / 8);
            const col = i % 8;
            const isDark = (row + col) % 2 === 1;
            const bg = isDark ? '#986B41' : '#FFFDD0'; 
            const piece = board[i];
            
            return (
              <div
                key={i}
                onClick={() => onSquareClick(i)}
                onTouchStart={(e) => onSquareTouchStart(e, i)}
                onDrop={(e) => {
                  e.preventDefault();
                  const from = Number(e.dataTransfer.getData('text/plain'));
                  if (!Number.isNaN(from)) {
                    const piece = board[from];
                    if (isPieceMovable(piece)) {
                      const legal = getLegalMoves(board, from);
                      if (legal.includes(i)) handleMove(from, i);
                    }
                  }
                  setDragging(null);
                  setGhost(null);
                  setGrabCursor(false);
                  setTargetIndex(null);
                }}
                data-index={i}
                onDragOver={(e) => {
                  e.preventDefault();
                  try { e.dataTransfer.dropEffect = 'move'; } catch {}
                  setTargetIndex(i);
                }}
                style={{ 
                  background: bg, 
                  cursor: 'pointer', 
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  height: '100%'
                }}
              >
                {piece && (
                  <img
                    src={`/pieces/${piece}.png`}
                    alt={piece}
                    draggable
                    onDragStart={(e: React.DragEvent<HTMLImageElement>) => {
                      if (!isPieceMovable(piece)) {
                        e.preventDefault();
                        return;
                      }
                      e.dataTransfer.setData('text/plain', String(i));
                      try { e.dataTransfer.effectAllowed = 'move'; } catch {}
                      try { const img = new Image(); img.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg"></svg>'; e.dataTransfer.setDragImage(img, 0, 0); } catch {}
                      setDragging(i);
                      setGrabCursor(true);
                      setGhost({ piece, x: e.clientX, y: e.clientY - Math.floor(square * 0.35), scale: 1.15 });
                    }}
                    onDragEnd={() => { setDragging(null); setGhost(null); setGrabCursor(false); setTargetIndex(null); }}
                    onTouchStart={(e) => onTouchStart(e, i)}
                    style={{
                      width: '85%',
                      height: '85%',
                      objectFit: 'contain',
                      position: 'relative',
                      transform: `${(selected === i || dragging === i) ? 'scale(1.12)' : ''}${userSide === 'black' ? ' rotate(180deg)' : ''}`.trim() || undefined,
                      transition: 'transform 0.12s ease',
                      zIndex: (selected === i || dragging === i) ? 2 : 1,
                      cursor: 'grab',
                      visibility: dragging === i ? 'hidden' : 'visible',
                    }}
                  />
                )}

                {(targetIndex === i || legalMoves.includes(i)) && (
                  <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: '35%', height: '35%', borderRadius: '50%', background: 'rgba(0,0,0,0.18)', pointerEvents: 'none', zIndex: 2 }} />
                )}
              </div>
            );
          })}
        </div>

        {/* BOTTOM PLAYER PANEL (YOUR USER) */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: '8px 12px', 
          background: '#262421', 
          borderRadius: '6px',
          border: '1px solid rgba(255,255,255,0.05)',
          fontSize: '14px',
          color: '#fff'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
            <div style={badgeStyle(userSide === 'black' ? '#000000' : '#ffffff')} />
            <span>u/{username ?? 'anonymous'}</span>
            <span style={{ fontSize: '11px', color: '#989795', fontWeight: 400 }}>
              ({userSide === 'black' ? 'Black' : 'White'})
            </span>
          </div>
        </div>

      </div>

      {/* RIGHT SIDE / SIDEBAR CONTAINER (BLOCKS 4 & 5) */}
      <div style={{ 
        flex: '1 1 280px', 
        maxWidth: '500px',
        width: '100%',
        display: 'flex', 
        flexDirection: 'column', 
        gap: '12px',
        background: '#262421', 
        padding: '16px', 
        borderRadius: '8px',
        boxShadow: '0 6px 18px rgba(0,0,0,0.3)',
        color: '#bababa',
        boxSizing: 'border-box',
        border: '1px solid rgba(255,255,255,0.05)'
      }}>
        
        {/* BLOCK 4: CAPTURED PIECES PANEL */}
        <div>
          <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', color: '#989795' }}>Material Captured</div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.03)', padding: '4px 8px', borderRadius: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, minWidth: '40px', color: '#fff' }}>White:</span>
              <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap' }}>
                {capturedByWhite.length > 0 ? capturedByWhite.map((piece, index) => (
                  <img key={`wcap-${index}`} src={`/pieces/${piece}.png`} alt={piece} style={{ width: 16, height: 16 }} />
                )) : <span style={{ color: '#535250', fontSize: '11px' }}>None</span>}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.03)', padding: '4px 8px', borderRadius: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, minWidth: '40px', color: '#fff' }}>Black:</span>
              <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap' }}>
                {capturedByBlack.length > 0 ? capturedByBlack.map((piece, index) => (
                  <img key={`bcap-${index}`} src={`/pieces/${piece}.png`} alt={piece} style={{ width: 16, height: 16 }} />
                )) : <span style={{ color: '#535250', fontSize: '11px' }}>None</span>}
              </div>
            </div>
          </div>
        </div>

        {/* BLOCK 5: ACTIONS / SUBMIT BUTTON */}
        <button 
          onClick={handleOnClick}
          disabled={submitting || moves.length !== 5}
          style={{
            marginTop: '4px',
            background: moves.length === 5 ? '#81b64c' : '#535250', // Gray out if not exactly 5 moves
            color: '#fff',
            border: 'none',
            padding: '10px 14px',
            borderRadius: '4px',
            fontSize: '14px',
            fontWeight: 700,
            cursor: moves.length === 5 && !submitting ? 'pointer' : 'not-allowed',
            boxShadow: moves.length === 5 ? '0 3px 0 #5b8433' : '0 3px 0 #3a3937',
            opacity: submitting ? 0.7 : 1,
            transition: 'all 0.1s ease',
            textAlign: 'center',
            width: '100%'
          }}
        >
          {submitting ? 'Submitting...' : `Submit Moves (${moves.length}/5)`}
        </button>

      </div>
    </div>

    {/* GHOST DRAG ELEMENT */}
    {ghost && (
      <img src={`/pieces/${ghost.piece}.png`} alt={ghost.piece} style={{ position: 'fixed', left: ghost.x, top: ghost.y, pointerEvents: 'none', transform: 'translate(-50%, -60%)', width: square * 0.96 * (ghost.scale ?? 1), height: square * 0.96 * (ghost.scale ?? 1), zIndex: 9999 }} />
    )}
  </div>
);
    
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Chessboard />
  </StrictMode>
);