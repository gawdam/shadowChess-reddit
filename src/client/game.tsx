import './index.css';

import React, { StrictMode, useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { useCounter } from './hooks/useCounter';
import type { MatchRecord, MoveInput, StoredMove } from '../shared/api';

type PieceColor = 'w' | 'b';
type PieceKind = 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'king';

type ReplayMove = {
  move: MoveInput;
  color: PieceColor;
};

type ReplayCaptureInfo = {
  piece: string;
  value: number;
  by: PieceColor;
};

type ReplayPosition = {
  board: (string | null)[];
  moves: Array<StoredMove & { color: PieceColor }>;
  score: number;
  captureByWhite: ReplayCaptureInfo | null;
  captureByBlack: ReplayCaptureInfo | null;
};

type ParsedReplayMove = {
  kind: PieceKind;
  to: number;
  promotion?: PieceKind;
};

type AppliedReplayMove = {
  board: (string | null)[];
  captured: string | null;
  move: StoredMove;
};

type ReplayMoveFailure = {
  reason: 'captured piece moved' | 'illegal move';
};


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
    const [moves, setMoves] = useState<Array<StoredMove & { color: PieceColor }>>([]);
    // Pop-up Modal visibility state
    const [showModal, setShowModal] = useState<boolean>(false);

    // Post-Game Replay Engine States
    const [activeReplay, setActiveReplay] = useState<MatchRecord | null>(null);

    const [replayPositions, setReplayPositions] = useState<ReplayPosition[]>([]);
    const [currentPly, setCurrentPly] = useState<number>(-1); // -1 means initial puzzle state
    const [liveReplayScore, setLiveReplayScore] = useState<number>(0);
    
    const handleOnClick = async () => {
    const moveRecords = moves.map(({ notation, pieceFrom, pieceTo }) => ({ notation, pieceFrom, pieceTo }));
    
    if (moveRecords.length !== 5) {
      alert(`Please finish your moves first (${moveRecords.length}/5)`);
      return;
    }

    const success = await submitMoves(moveRecords);
    if (success) {
      // Clear interactive UI gameplay tracking states
      setSelected(null);
      setLegalMoves([]);
      setMoves([]);
      setCapturedByWhite([]);
      setCapturedByBlack([]);
      
      // Trigger the success scoreboard pop-up
      setShowModal(true);
      }
    };

    const pieceValues: Record<PieceKind, number> = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, king: 15 };
    const promotionValues: Partial<Record<PieceKind, number>> = { knight: 3, bishop: 3, rook: 5, queen: 9 };
    const pieceLetterToKind: Record<string, PieceKind> = {
      N: 'knight',
      B: 'bishop',
      R: 'rook',
      Q: 'queen',
      K: 'king',
    };

    const sanitizeSan = (san: string) =>
      san
        .trim()
        .replace(/^\d+\.(\.\.)?/, '')
        .replace(/[+#?!]+$/g, '')
        .trim();

    const getSquareIndex = (file: string, rank: string) => {
      const fileIndex = file.charCodeAt(0) - 'a'.charCodeAt(0);
      const rankNumber = Number(rank);

      if (fileIndex < 0 || fileIndex > 7 || rankNumber < 1 || rankNumber > 8) {
        return null;
      }

      return (8 - rankNumber) * 8 + fileIndex;
    };

    const parseReplayMove = (notation: string): ParsedReplayMove | null => {
      const cleanSan = sanitizeSan(notation);
      const withoutPromotion = cleanSan.replace(/=([NBRQ])$/, '');
      const promotionMatch = cleanSan.match(/=([NBRQ])$/);
      const destinationMatch = withoutPromotion.match(/([a-h])([1-8])$/);

      if (!destinationMatch) return null;

      const to = getSquareIndex(destinationMatch[1] ?? '', destinationMatch[2] ?? '');
      if (to === null) return null;

      const firstToken = withoutPromotion[0] ?? '';
      const parsedMove: ParsedReplayMove = {
        kind: pieceLetterToKind[firstToken] ?? 'pawn',
        to,
      };

      const promotion = promotionMatch ? pieceLetterToKind[promotionMatch[1] ?? ''] : undefined;
      if (promotion) {
        parsedMove.promotion = promotion;
      }

      return parsedMove;
    };

    const isStoredMove = (move: MoveInput): move is StoredMove =>
      typeof move !== 'string' &&
      typeof move.notation === 'string' &&
      typeof move.pieceFrom === 'number' &&
      typeof move.pieceTo === 'number';

    const getMoveNotation = (move: MoveInput) => typeof move === 'string' ? move : move.notation;

    const isPieceKind = (value: string): value is PieceKind =>
      value === 'pawn' ||
      value === 'knight' ||
      value === 'bishop' ||
      value === 'rook' ||
      value === 'queen' ||
      value === 'king';

    const getPieceColor = (piece: string): PieceColor => piece.startsWith('white_') ? 'w' : 'b';

    const headerFontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

    const getPieceKind = (piece: string): PieceKind | null => {
      const kind = piece.split('_')[1] ?? '';
      return isPieceKind(kind) ? kind : null;
    };

    const isPathClear = (boardState: (string | null)[], from: number, to: number) => {
      const fromRow = Math.floor(from / 8);
      const fromCol = from % 8;
      const toRow = Math.floor(to / 8);
      const toCol = to % 8;
      const rowStep = Math.sign(toRow - fromRow);
      const colStep = Math.sign(toCol - fromCol);
      let row = fromRow + rowStep;
      let col = fromCol + colStep;

      while (row !== toRow || col !== toCol) {
        if (boardState[row * 8 + col]) return false;
        row += rowStep;
        col += colStep;
      }

      return true;
    };

    const isLegalPieceMove = (boardState: (string | null)[], from: number, to: number) => {
      if (from === to || from < 0 || from > 63 || to < 0 || to > 63) return false;

      const piece = boardState[from];
      if (!piece) return false;

      const pieceColor = getPieceColor(piece);
      const destPiece = boardState[to];
      if (destPiece && getPieceColor(destPiece) === pieceColor) return false;

      const kind = getPieceKind(piece);
      if (!kind) return false;

      const fromRow = Math.floor(from / 8);
      const fromCol = from % 8;
      const toRow = Math.floor(to / 8);
      const toCol = to % 8;
      const rowDelta = toRow - fromRow;
      const colDelta = toCol - fromCol;
      const absRowDelta = Math.abs(rowDelta);
      const absColDelta = Math.abs(colDelta);

      if (kind === 'rook') {
        return (rowDelta === 0 || colDelta === 0) && isPathClear(boardState, from, to);
      }

      if (kind === 'bishop') {
        return absRowDelta === absColDelta && isPathClear(boardState, from, to);
      }

      if (kind === 'queen') {
        return (rowDelta === 0 || colDelta === 0 || absRowDelta === absColDelta) && isPathClear(boardState, from, to);
      }

      if (kind === 'knight') {
        return (absRowDelta === 2 && absColDelta === 1) || (absRowDelta === 1 && absColDelta === 2);
      }

      if (kind === 'king') {
        return absRowDelta <= 1 && absColDelta <= 1;
      }

      const direction = pieceColor === 'w' ? -1 : 1;
      const startingRow = pieceColor === 'w' ? 6 : 1;

      if (colDelta === 0 && rowDelta === direction) {
        return !destPiece;
      }

      if (colDelta === 0 && fromRow === startingRow && rowDelta === direction * 2) {
        const middle = boardState[(fromRow + direction) * 8 + fromCol];
        return !middle && !destPiece;
      }

      return absColDelta === 1 && rowDelta === direction && Boolean(destPiece);
    };

    const applyReplayMove = (
      boardState: (string | null)[],
      color: PieceColor,
      move: MoveInput,
      isVariantGame: boolean = true // Add a flag to allow variant rules
    ): AppliedReplayMove | ReplayMoveFailure | null => {
      const notation = getMoveNotation(move);
      const colorName = color === 'w' ? 'white' : 'black';

      let from = -1;
      let to = -1;
      let promotion: string | null = null;

      // --- STEP 1: RESOLVE COORDINATES ---
      if (isStoredMove(move)) {
        if (move.pieceFrom < 0 || move.pieceFrom > 63 || move.pieceTo < 0 || move.pieceTo > 63 || move.pieceFrom === move.pieceTo) {
          return {
            reason: 'illegal move',
          };
        }
        from = move.pieceFrom;
        to = move.pieceTo;
        const parsedMove = parseReplayMove(notation);
        promotion = parsedMove?.promotion ?? null;
      } else {
        const parsedMove = parseReplayMove(notation);
        if (!parsedMove) return null;
        to = parsedMove.to;
        promotion = parsedMove.promotion ?? null;

        // Modified fallback search to account for friendly captures if variant rules apply
        from = boardState.findIndex((piece, index) => {
          const basicPieceMatch = piece === `${colorName}_${parsedMove.kind}`;
          if (!basicPieceMatch) return false;
          
          // If it's standard chess rules, validate normally.
          // If it's a self-capture variant, we might bypass standard validation.
          return isLegalPieceMove(boardState, index, to) || isVariantGame;
        });

        if (from === -1) {
          const matchingPieceExists = boardState.some((piece) => piece === `${colorName}_${parsedMove.kind}`);
          return {
            reason: matchingPieceExists ? 'illegal move' : 'captured piece moved',
          };
        }
      }

      // --- STEP 2: PIECE & LEGALITY CHECK ---
      const movingPiece = boardState[from];
      if (!movingPiece) {
        return {
          reason: 'captured piece moved',
        };
      }

      if (!movingPiece.startsWith(`${colorName}_`)) {
        return {
          reason: 'illegal move',
        };
      }

      const targetPiece = boardState[to];
      const isSelfCapture = targetPiece?.startsWith(`${colorName}_`);

      // Bypassing standard logic: If it's a self-capture and variant is enabled, skip standard validation
      if (isSelfCapture && isVariantGame) {
        // Optional: Add simple pseudo-legal path verification here if needed 
        // (e.g., ensuring a Rook moves in straight lines even if hitting its own piece)
      } else {
        // Standard rule path
        if (!isLegalPieceMove(boardState, from, to)) {
          return {
            reason: 'illegal move',
          };
        }
      }

      // --- STEP 3: EXECUTE MOVE ---
      const nextBoard = boardState.slice();
      let captured = nextBoard[to] ?? null;

      // Apply movement/promotion
      nextBoard[to] = promotion ? `${colorName}_${promotion}` : movingPiece;
      nextBoard[from] = null;

      return {
        board: nextBoard,
        captured,
        move: isStoredMove(move) ? move : {
          notation: sanitizeSan(notation) || notation,
          pieceFrom: from,
          pieceTo: to,
        },
      };
    };

    const getReplayScoreDelta = (color: PieceColor, captured: string | null, notation: string) => {
      const promotion = parseReplayMove(notation)?.promotion;
      const capturedKind = captured?.split('_')[1] ?? '';
      let swing = isPieceKind(capturedKind) ? pieceValues[capturedKind] : 0;

      if (promotion) {
        swing += promotionValues[promotion] ?? 0;
      }

      return color === 'w' ? swing : -swing;
    };

    const getCapturedPieceValue = (captured: string | null) => {
      const capturedKind = captured?.split('_')[1] ?? '';
      return isPieceKind(capturedKind) ? pieceValues[capturedKind] : 0;
    };

    const buildReplayTimeline = (match: MatchRecord, startingTurn: PieceColor): ReplayMove[] => {
      if (!userData.userSide) return [];

      const whiteSource = [...(userData.userSide === 'white' ? match.userMoves : match.opponentMoves)];
      const blackSource = [...(userData.userSide === 'black' ? match.userMoves : match.opponentMoves)];
      const timeline: ReplayMove[] = [];
      
      let currentTurn = startingTurn;

      // Keep pulling moves in strict alternating order until both sources are empty
      while (whiteSource.length > 0 || blackSource.length > 0) {
        if (currentTurn === 'w') {
          if (whiteSource.length > 0) {
            timeline.push({ move: whiteSource.shift()!, color: 'w' });
          }
          currentTurn = 'b'; // Hand over turn to black
        } else {
          if (blackSource.length > 0) {
            timeline.push({ move: blackSource.shift()!, color: 'b' });
          }
          currentTurn = 'w'; // Hand over turn to white
        }
      }

      return timeline;
    };

    const buildReplayPositions = (fen: string, timeline: ReplayMove[]): ReplayPosition[] => {
      let replayBoard = parseFEN(fen).board;
      const positions: ReplayPosition[] = [{
        board: replayBoard,
        moves: [],
        score: 0,
        captureByWhite: null,
        captureByBlack: null,
      }];
      let runningWhiteAdvantage = 0;
      const appliedMoves: Array<StoredMove & { color: PieceColor }> = [];
      let captureByWhite: ReplayCaptureInfo | null = null;
      let captureByBlack: ReplayCaptureInfo | null = null;

      for (const replayMove of timeline) {
        const appliedMove = applyReplayMove(replayBoard, replayMove.color, replayMove.move, true); // Enable variant rules for self-capture

        if (!appliedMove || 'reason' in appliedMove) {
          const failureReason = appliedMove && 'reason' in appliedMove
            ? appliedMove
            : {
                reason: 'illegal move' as const,
              };
          runningWhiteAdvantage += replayMove.color === 'w' ? -15 : 15;
          appliedMoves.push({
            notation: `${sanitizeSan(getMoveNotation(replayMove.move)) || getMoveNotation(replayMove.move)} (${failureReason.reason})`,
            color: replayMove.color,
            pieceFrom: -1,
            pieceTo: -1,
          });
          positions.push({
            board: replayBoard,
            moves: [...appliedMoves],
            score: userData.userSide === 'white' ? runningWhiteAdvantage : -runningWhiteAdvantage,
            captureByWhite,
            captureByBlack,
          });
          break;
        }

        replayBoard = appliedMove.board;
        runningWhiteAdvantage += getReplayScoreDelta(replayMove.color, appliedMove.captured, getMoveNotation(replayMove.move));
        appliedMoves.push({ ...appliedMove.move, color: replayMove.color });
        const capturedValue = getCapturedPieceValue(appliedMove.captured);
        if (appliedMove.captured && capturedValue > 0) {
          const captureInfo: ReplayCaptureInfo = {
            piece: appliedMove.captured,
            value: capturedValue,
            by: replayMove.color,
          };
          if (replayMove.color === 'w') {
            captureByWhite = captureInfo;
          } else {
            captureByBlack = captureInfo;
          }
        }

        positions.push({
          board: replayBoard,
          moves: [...appliedMoves],
          score: userData.userSide === 'white' ? runningWhiteAdvantage : -runningWhiteAdvantage,
          captureByWhite,
          captureByBlack,
        });
      }

      return positions;
    };

    // Setup a chosen match for replay simulation
    const loadReplayGame = (match: MatchRecord | null) => {
      if (!match || !gameData) return;
      
      setActiveReplay(match);
      setCurrentPly(-1); // Reset back to baseline FEN

      const timeline = buildReplayTimeline(match, gameData.turn);
      const positions = buildReplayPositions(gameData.fen, timeline);
      setReplayPositions(positions);
      setBoard(positions[0]?.board ?? parseFEN(gameData.fen).board);
      setMoves(positions[0]?.moves ?? []);
      setLiveReplayScore(positions[0]?.score ?? 0);
    };

    // Re-simulate timeline changes sequentially to update board and live scores
    const stepTimeline = (targetPly: number) => {
      const boundedPly = Math.max(-1, Math.min(targetPly, replayPositions.length - 2));
      const position = replayPositions[boundedPly + 1];
      if (!position) return;

      setBoard(position.board);
      setMoves(position.moves);
      setCurrentPly(boundedPly);
      setLiveReplayScore(position.score);
    };



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
      setMoves((prev) => [...prev, { notation: moveNotation, color: pieceColor, pieceFrom: from, pieceTo: to }]);

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

    // Piece movement rules, without check/checkmate validation.
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
          moves.push(idx(r, c));
        }
      }
      if (kind === 'king') {
        for (let dr=-1; dr<=1; dr++) for (let dc=-1; dc<=1; dc++) {
          if (dr===0 && dc===0) continue;
          const r = r0+dr, c = c0+dc;
          if (!inBounds(r,c)) continue;
          moves.push(idx(r,c));
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

    const { gameData, userData, submitMoves, submitting, selectSide, playerCounts } = useCounter();
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
      transform: userData.userSide === 'black' ? 'rotate(180deg)' : undefined,
      fontFamily: headerFontFamily,
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

    React.useEffect(() => {
      if (!gameData || !userData.hasSubmitted || activeReplay) return;
      const defaultReplay = userData.bestMatch ?? userData.worstMatch;
      if (!defaultReplay) return;

      const replayTimer = window.setTimeout(() => loadReplayGame(defaultReplay), 0);
      return () => window.clearTimeout(replayTimer);
    }, [gameData, userData.hasSubmitted, userData.bestMatch, userData.worstMatch, activeReplay, loadReplayGame]);

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
      if (userData.userSide === 'black') return piece.startsWith('black_');
      if (userData.userSide === 'white') return piece.startsWith('white_');
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

    const isReplayMode = userData.hasSubmitted && activeReplay !== null;
    const currentReplayPosition = replayPositions[currentPly + 1] ?? null;
    const maxReplayPly = Math.max(-1, replayPositions.length - 2);
    const isAtReplayStart = currentPly <= -1;
    const isAtReplayEnd = currentPly >= maxReplayPly;
    const userColor: PieceColor = userData.userSide === 'white' ? 'w' : 'b';
    const opponentColor: PieceColor = userColor === 'w' ? 'b' : 'w';
    const displayedUserScore = isReplayMode ? liveReplayScore : userData.score;
    const displayedOpponentScore = isReplayMode ? -liveReplayScore : null;

    const getReplayCaptureForSide = (side: PieceColor) => {
      if (!currentReplayPosition) return null;
      return side === 'w' ? currentReplayPosition.captureByWhite : currentReplayPosition.captureByBlack;
    };

    const renderReplayCaptureBadge = (side: PieceColor) => {
      if (!isReplayMode) return null;
      const capture = getReplayCaptureForSide(side);
      if (!capture) return null;

      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            marginLeft: '8px',
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '999px',
            padding: '2px 8px',
            fontSize: '11px',
            fontWeight: 700,
            color: '#81b64c',
          }}
        >
          <img
            src={`/pieces/${capture.piece}.png`}
            alt={capture.piece}
            style={{ width: 14, height: 14 }}
          />
          <span>+{capture.value}</span>
        </span>
      );
    };
    const showOpponentPlaceholder =
      (gameMeta?.turn === 'b' && userData.userSide === 'white') ||
      (gameMeta?.turn === 'w' && userData.userSide === 'black');
    if (!userData.userSide) {
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
    {/* ================= SUCCESS SCORE POP-UP OVERLAY ================= */}
    {showModal && (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px'
      }}>
        <div style={{
          backgroundColor: '#211f1c', border: '1px solid #81b64c',
          borderRadius: '8px', padding: '32px', maxWidth: '400px', width: '100%', textAlign: 'center'
        }}>
          <h2 style={{ color: '#81b64c', margin: '0 0 12px 0' }}>Turn Complete, {userData.username}!</h2>
          <p style={{ color: '#bababa' }}>Your aggregate matrix score against all active opponents has been saved.</p>
          <h1 style={{ fontSize: '48px', color: '#fff', margin: '16px 0' }}>{userData.score} pts</h1>
          <button 
            onClick={() => {
              setShowModal(false);
              loadReplayGame(userData.bestMatch ?? userData.worstMatch);
            }}
            style={{
              background: '#81b64c', color: '#fff', border: 'none', padding: '12px 24px',
              borderRadius: '4px', fontWeight: 700, cursor: 'pointer', width: '100%'
            }}
          >
            Continue to Dashboard
          </button>
        </div>
      </div>
    )}

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
      
      {isReplayMode ? (
        <>
          <span style={{ color: '#81b64c', fontWeight: 600, marginRight: '8px' }}>
            vs u/{activeReplay?.opponent}
          </span>
          {moves.length > 0 ? moves.map((m, idx) => (
            <span
              key={`${m.color}-${idx}-${m.notation}`}
              style={{
                color: idx === currentPly ? '#fff' : '#bababa',
                fontWeight: idx === currentPly ? 800 : 500,
                marginRight: '6px',
              }}
            >
              <span style={{ color: '#706e6b' }}>{Math.floor(idx / 2) + 1}{m.color === 'b' ? '...' : '.'}</span> {m.notation}
            </span>
          )) : (
            <span style={{ color: '#989795' }}>Initial position</span>
          )}
        </>
      ) : (
        <>
          {showOpponentPlaceholder && (
            <span style={{ fontWeight: 800 }}><span style={{ color: '#706e6b' }}>1.</span> <span style={{ color: '#c01812' }}>?</span></span>
          )}

          {moves.map((m, idx) => (
            <div key={idx}>
              <span style={{ fontWeight: 500, marginRight: '6px' }}>
                <span style={{ color: '#706e6b' }}>{idx + 1}.</span> {m.notation}
              </span>
              {idx !== 4 && showOpponentPlaceholder && (
                <span style={{ fontWeight: 800, marginRight: '6px' }}>
                  <span style={{ color: '#706e6b' }}>{idx + 2}.</span> <span style={{ color: '#c01812' }}>?</span>
                </span>
              )}
              {!showOpponentPlaceholder && (
                <span style={{ fontWeight: 800, marginRight: '6px' }}>
                  <span style={{ color: '#706e6b' }}>{idx + 1}.</span> <span style={{ color: '#c01812' }}>?</span>
                </span>
              )}
            </div>
          ))}
        </>
      )}
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
            <div style={badgeStyle(userData.userSide === 'white' ? '#000000' : '#ffffff')} />
            <span>{isReplayMode ? `u/${activeReplay?.opponent}` : 'ShadowChess GM'}</span>
            {renderReplayCaptureBadge(opponentColor)}
            <span style={{ fontSize: '11px', color: '#989795', fontWeight: 400 }}>
              ({userData.userSide === 'white' ? 'Black' : 'White'})
            </span>
          </div>
          {isReplayMode && (
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#81b64c' }}>
              {displayedOpponentScore} pts
            </div>
          )}
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
            overflow: 'hidden',
            position: 'relative'
          }} 
          onDragOver={userData.hasSubmitted ? undefined : onBoardDragOver} 
          onDrop={userData.hasSubmitted ? undefined : onBoardDrop}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              zIndex: 3,
              fontFamily: headerFontFamily,
            }}
          >
          </div>
          {Array.from({ length: 64 }).map((_, i) => {
            const row = Math.floor(i / 8);
            const col = i % 8;
            const isDark = (row + col) % 2 === 1;
            const bg = isDark ? '#986B41' : '#FFFDD0'; 
            const piece = board[i];
            const labelColor = isDark ? 'rgba(244, 239, 228, 0.9)' : 'rgba(34, 32, 29, 0.78)';
            const isBlackView = userData.userSide === 'black';
            const showRankLabel = isBlackView ? col === 7 : col === 0;
            const showFileLabel = isBlackView ? row === 0 : row === 7;
            const rankLabel = String(isBlackView ? 8 - row : row + 1);
            const fileLabel = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'][col] ?? '';
            const rankLabelStyle: React.CSSProperties = isBlackView
              ? { position: 'absolute', right: 5, bottom: 4, fontSize: '9px', fontWeight: 800, color: labelColor, lineHeight: 1, transform: 'rotate(180deg)' }
              : { position: 'absolute', top: 4, left: 5, fontSize: '9px', fontWeight: 800, color: labelColor, lineHeight: 1 };
            const fileLabelStyle: React.CSSProperties = isBlackView
              ? { position: 'absolute', top: 4, left: 5, fontSize: '9px', fontWeight: 800, color: labelColor, lineHeight: 1, textTransform: 'lowercase', transform: 'rotate(180deg)' }
              : { position: 'absolute', right: 5, bottom: 4, fontSize: '9px', fontWeight: 800, color: labelColor, lineHeight: 1, textTransform: 'lowercase' };
            
            return (
              <div
                key={i}
                onClick={() => !userData.hasSubmitted && onSquareClick(i)}
                onTouchStart={(e) => !userData.hasSubmitted && onSquareTouchStart(e, i)}
                onDrop={(e) => {
                  if (userData.hasSubmitted) return;
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
                  if (userData.hasSubmitted) return;
                  e.preventDefault();
                  try { e.dataTransfer.dropEffect = 'move'; } catch {}
                  setTargetIndex(i);
                }}
                style={{ 
                  background: bg, 
                  cursor: userData.hasSubmitted ? 'default' : 'pointer', 
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  height: '100%',
                  fontFamily: headerFontFamily,
                }}
              >
                {showRankLabel && (
                  <span style={rankLabelStyle}>{rankLabel}</span>
                )}
                {showFileLabel && (
                  <span style={fileLabelStyle}>{fileLabel}</span>
                )}
                {piece && (
                  <img
                    src={`/pieces/${piece}.png`}
                    alt={piece}
                    draggable={!userData.hasSubmitted}
                    onDragStart={(e: React.DragEvent<HTMLImageElement>) => {
                      if (userData.hasSubmitted || !isPieceMovable(piece)) {
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
                    onDragEnd={() => { if (!userData.hasSubmitted) { setDragging(null); setGhost(null); setGrabCursor(false); setTargetIndex(null); } }}
                    onTouchStart={(e) => !userData.hasSubmitted && onTouchStart(e, i)}
                    style={{
                      width: '85%',
                      height: '85%',
                      objectFit: 'contain',
                      position: 'relative',
                      transform: `${(selected === i || dragging === i) ? 'scale(1.12)' : ''}${userData.userSide === 'black' ? ' rotate(180deg)' : ''}`.trim() || undefined,
                      transition: 'transform 0.12s ease',
                      zIndex: (selected === i || dragging === i) ? 2 : 1,
                      cursor: userData.hasSubmitted ? 'default' : 'grab',
                      visibility: dragging === i ? 'hidden' : 'visible',
                    }}
                  />
                )}

                {!userData.hasSubmitted && (targetIndex === i || legalMoves.includes(i)) && (
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
            <div style={badgeStyle(userData.userSide === 'black' ? '#000000' : '#ffffff')} />
            <span>u/{userData.username ?? 'anonymous'}</span>
            {renderReplayCaptureBadge(userColor)}
            <span style={{ fontSize: '11px', color: '#989795', fontWeight: 400 }}>
              ({userData.userSide === 'black' ? 'Black' : 'White'})
            </span>
          </div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#81b64c' }}>
            {displayedUserScore} pts
          </div>
        </div>

        {/* ================= LEFT & RIGHT BUTTON PANEL (UNDER THE BOARD) ================= */}
        {isReplayMode && (
          <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr 44px', alignItems: 'center', width: '100%', margin: '12px 0' }}>
            <button 
              type="button"
              disabled={isAtReplayStart}
              onClick={() => stepTimeline(currentPly - 1)}
              onTouchEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!isAtReplayStart) stepTimeline(currentPly - 1);
              }}
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '8px',
                border: 'none',
                background: isAtReplayStart ? 'rgba(129,182,76,0.35)' : 'linear-gradient(135deg, #8fc75a, #70a73f)',
                color: '#ffffff',
                cursor: isAtReplayStart ? 'not-allowed' : 'pointer',
                opacity: isAtReplayStart ? 0.55 : 1,
                boxShadow: isAtReplayStart ? 'none' : '0 6px 16px rgba(129,182,76,0.35)',
                fontSize: '18px',
                fontWeight: 900,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                justifySelf: 'start',
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
                userSelect: 'none',
              }}
            >
              ◀
            </button>
            <div style={{
              minWidth: '130px',
              textAlign: 'center',
              fontSize: '12px',
              fontWeight: 700,
              color: '#d9d8d6',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '999px',
              padding: '8px 12px',
              justifySelf: 'center',
            }}>
              Move {Math.max(currentPly + 1, 0)}
            </div>
            <button 
              type="button"
              disabled={isAtReplayEnd}
              onClick={() => stepTimeline(currentPly + 1)}
              onTouchEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!isAtReplayEnd) stepTimeline(currentPly + 1);
              }}
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '8px',
                border: 'none',
                background: isAtReplayEnd ? 'rgba(129,182,76,0.35)' : 'linear-gradient(135deg, #8fc75a, #70a73f)',
                color: '#ffffff',
                cursor: isAtReplayEnd ? 'not-allowed' : 'pointer',
                opacity: isAtReplayEnd ? 0.55 : 1,
                boxShadow: isAtReplayEnd ? 'none' : '0 6px 16px rgba(129,182,76,0.35)',
                fontSize: '18px',
                fontWeight: 900,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                justifySelf: 'end',
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
                userSelect: 'none',
              }}
            >
              ▶
            </button>
          </div>
        )}

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
        
        {!userData.hasSubmitted ? (
          <>
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
                background: moves.length === 5 ? '#81b64c' : '#535250', 
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
          </>
        ) : (
          /* ================= POST-MORTEM DASHBOARD SELECTOR ================= */
          <div>
            <h3 style={{ margin: '0 0 4px 0', color: '#fff' }}>Post-Game Dashboard</h3>
            <p style={{ fontSize: '12px', color: '#989795', margin: '0 0 16px 0' }}>
              Aggregate Score: <span style={{ color: '#fff', fontWeight: 700 }}>{userData.score} pts</span>
            </p>
            
            {/* Best Match Button Card */}
            {userData.bestMatch ? (
              <div style={{ background: 'rgba(129,182,76,0.1)', border: '1px solid #81b64c', padding: '12px', borderRadius: '6px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 'bold', color: '#81b64c' }}>🏆 Best Match</span>
                  <span style={{ color: '#fff', fontWeight: 600 }}>+{userData.bestMatch.score} pts</span>
                </div>
                <button 
                  onClick={() => loadReplayGame(userData.bestMatch)}
                  style={{ width: '100%', background: '#81b64c', border: 'none', color: '#fff', padding: '8px', borderRadius: '4px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Simulate vs u/{userData.bestMatch.opponent}
                </button>
              </div>
            ) : (
              <p style={{ fontSize: '12px', color: '#535250' }}>No top performance record found.</p>
            )}

            {/* Worst Match Button Card */}
            {userData.worstMatch ? (
              <div style={{ background: 'rgba(192,24,18,0.1)', border: '1px solid #c01812', padding: '12px', borderRadius: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 'bold', color: '#c01812' }}>📉 Worst Match</span>
                  <span style={{ color: '#fff', fontWeight: 600 }}>{userData.worstMatch.score} pts</span>
                </div>
                <button 
                  onClick={() => loadReplayGame(userData.worstMatch)}
                  style={{ width: '100%', background: '#c01812', border: 'none', color: '#fff', padding: '8px', borderRadius: '4px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Simulate vs u/{userData.worstMatch.opponent}
                </button>
              </div>
            ) : (
              <p style={{ fontSize: '12px', color: '#535250' }}>No low performance record found.</p>
            )}
          </div>
        )}

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
