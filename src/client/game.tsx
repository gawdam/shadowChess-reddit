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

    const squareStyle: React.CSSProperties = {
      width: square,
      height: square,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
    };

    const pieceImgStyle: React.CSSProperties = {
      width: '96%',
      height: '96%',
      objectFit: 'contain',
      pointerEvents: 'auto',
      touchAction: 'none',
      transformOrigin: 'center center',
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

    const headerStyle: React.CSSProperties = {
      textAlign: 'center',
      fontSize: 34,
      fontWeight: 700,
      letterSpacing: '0.18em',
      color: '#000000',
      textShadow: 'none',
      fontFamily: '"MADE Cannes", "Fira Code", Consolas, Menlo, Monaco, monospace',
      marginBottom: 6,
    };

    const subtitleStyle: React.CSSProperties = {
      textAlign: 'center',
      fontSize: 15,
      fontWeight: 500,
      letterSpacing: '0.08em',
      color: '#4d453d',
      marginBottom: 4,
    };

    const playerInfoStyle: React.CSSProperties = {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 10,
      width: '100%',
      maxWidth: 480,
      textAlign: 'center',
    };

    const usernamePanelStyle: React.CSSProperties = {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 10,
      width: '100%',
      padding: '12px 14px',
      borderRadius: 16,
      background: '#fff8f0',
      border: '1px solid rgba(0,0,0,0.06)',
      boxShadow: '0 0 16px rgba(0,0,0,0.05)',
      marginTop: 12,
    };

    const usernameRowStyle: React.CSSProperties = {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      color: '#111111',
      fontSize: 14,
      fontWeight: 600,
    };

    const captureRowStyle: React.CSSProperties = {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
      justifyContent: 'center',
      fontSize: 12,
      color: '#000000',
    };

    const playerRowStyle: React.CSSProperties = {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      color: '#000000',
      fontSize: 14,
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

    const boardFlipped = gameMeta?.turn === 'b';
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
      transform: boardFlipped ? 'rotate(180deg)' : undefined,
    };

    const gameTitle = `${gameMeta?.white ?? 'White'} vs ${gameMeta?.black ?? 'Black'}`;
    const gameSubtitle = gameMeta?.event || (gameMeta?.year ? `${gameMeta.year} Chess championship` : 'Chess championship');
    const titleKing = gameMeta?.turn === 'b' ? '♚' : '♔';
    const titleText = `${titleKing} ${gameTitle} ${titleKing}`;

    const { username, gameData } = useCounter();

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
      if (gameMeta?.turn === 'b') return piece.startsWith('black_');
      if (gameMeta?.turn === 'w') return piece.startsWith('white_');
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

    return (
      <div
        style={appStyle}
        onMouseDown={onOutsidePointerDown}
        onTouchStart={onOutsidePointerDown}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, width: '100%' }}>
          <div style={playerInfoStyle}>
            <div style={headerStyle}>{titleText}</div>
            <div style={subtitleStyle}>{gameSubtitle}</div>
            <div style={playerRowStyle}>
              <div style={badgeStyle('#ffffff')} />
              <span>White: {gameMeta?.white ?? 'White'}</span>
            </div>
            <div style={playerRowStyle}>
              <div style={badgeStyle('#000000')} />
              <span>Black: {gameMeta?.black ?? 'Black'}</span>
            </div>
            <div style={{ fontSize: 12, color: '#000000' }}>{gameMeta?.turn === 'b' ? 'Black to play' : 'White to play'}</div>
          </div>

          <div ref={boardRef} style={boardStyle} onDragOver={onBoardDragOver} onDrop={onBoardDrop}>
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
                  style={{ ...squareStyle, background: bg, cursor: 'pointer', position: 'relative' }}
                >
                  {piece && (
                    <img
                      src={`/pieces/${piece}.png`}
                      alt={piece}
                      draggable
                      onDragStart={(e: React.DragEvent<HTMLImageElement>) => {
                        // prevent dragging pieces that aren't allowed to move this turn
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
                        console.debug('onDragStart', { from: i, clientX: e.clientX, clientY: e.clientY });
                      }}
                      onDragEnd={() => { setDragging(null); setGhost(null); setGrabCursor(false); setTargetIndex(null); }}
                      onTouchStart={(e) => onTouchStart(e, i)}
                      style={{
                        ...pieceImgStyle,
                        position: 'relative',
                        transform: `${(selected === i || dragging === i) ? 'scale(1.15)' : ''}${boardFlipped ? ' rotate(180deg)' : ''}`.trim() || undefined,
                        transition: 'transform 0.12s ease',
                        zIndex: (selected === i || dragging === i) ? 2 : 1,
                        cursor: 'grab',
                        visibility: dragging === i ? 'hidden' : 'visible',
                      }}
                    />
                  )}

                  {(targetIndex === i || legalMoves.includes(i)) && (
                    <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: square * 0.6, height: square * 0.6, borderRadius: '50%', background: 'rgba(0,0,0,0.1)', pointerEvents: 'none', zIndex: 2 }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div style={usernamePanelStyle}>
          <div style={usernameRowStyle}>
            <div style={badgeStyle(gameMeta?.turn === 'b' ? '#000000' : '#ffffff')} />
            <span>u/{username ?? 'anonymous'}</span>
            <span style={{ color: '#766e63', fontSize: 12 }}>
              {gameMeta?.turn === 'b' ? 'Black' : 'White'} player
            </span>
          </div>
          <div style={captureRowStyle}>
            <span style={{ fontWeight: 700, color: '#3e352f' }}>White captured:</span>
            {capturedByWhite.length > 0 ? capturedByWhite.map((piece, index) => (
              <img key={`wcap-${index}`} src={`/pieces/${piece}.png`} alt={piece} style={{ width: 20, height: 20 }} />
            )) : <span style={{ color: '#7f756d' }}>none</span>}
          </div>
          <div style={captureRowStyle}>
            <span style={{ fontWeight: 700, color: '#3e352f' }}>Black captured:</span>
            {capturedByBlack.length > 0 ? capturedByBlack.map((piece, index) => (
              <img key={`bcap-${index}`} src={`/pieces/${piece}.png`} alt={piece} style={{ width: 20, height: 20 }} />
            )) : <span style={{ color: '#7f756d' }}>none</span>}
          </div>
        </div>

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
