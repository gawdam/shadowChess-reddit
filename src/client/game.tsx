import './index.css';

import React, { StrictMode, useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { useCounter } from './hooks/useCounter';
import type { MatchRecord, MoveInput, StoredMove } from '../shared/api';

type PieceColor = 'w' | 'b';
type PieceKind = 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'king';
type ThemeMode = 'light' | 'dark';

type ReplayMove = {
  move: MoveInput;
  color: PieceColor;
};

type ReplayPosition = {
  board: (string | null)[];
  moves: Array<StoredMove & { color: PieceColor }>;
  score: number;
  capturesByWhite: string[];
  capturesByBlack: string[];
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

type PromotionChoice = 'knight' | 'bishop' | 'rook' | 'queen';

type PendingPromotion = {
  from: number;
  to: number;
  color: PieceColor;
  movingPiece: string;
  capturedPiece: string | null;
};

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

const usePieceAssetsReady = () => {
  const [ready, setReady] = useState(false);

  React.useEffect(() => {
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

const LoadingSpinner = ({ size = 44, accent = '#81b64c' }: { size?: number; accent?: string }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: '50%',
      border: `${Math.max(3, Math.floor(size / 10))}px solid rgba(255,255,255,0.16)`,
      borderTopColor: accent,
      animation: 'asyncchess-spin 0.9s linear infinite',
      boxSizing: 'border-box',
    }}
  />
);

const LoadingPanel = ({
  title,
  detail,
  overlay,
}: {
  title: string;
  detail: string;
  overlay?: boolean;
}) => (
  <div
    style={{
      position: overlay ? 'absolute' : 'fixed',
      inset: 0,
      zIndex: overlay ? 6 : 10001,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: overlay ? 'rgba(17, 17, 17, 0.58)' : 'rgba(15, 15, 15, 0.78)',
      backdropFilter: 'blur(6px)',
      padding: '20px',
    }}
  >
    <div
      style={{
        minWidth: 'min(320px, 92vw)',
        maxWidth: '420px',
        borderRadius: '14px',
        border: '1px solid rgba(129, 182, 76, 0.32)',
        background: 'rgba(28, 27, 24, 0.96)',
        padding: '24px',
        textAlign: 'center',
        color: '#f5f1e8',
        boxShadow: '0 18px 48px rgba(0,0,0,0.38)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
        <LoadingSpinner />
      </div>
      <div style={{ fontSize: '18px', fontWeight: 800, marginBottom: '8px' }}>{title}</div>
      <div style={{ fontSize: '13px', lineHeight: 1.5, color: 'rgba(245,241,232,0.74)' }}>{detail}</div>
    </div>
  </div>
);

const promotionLetterMap: Record<PromotionChoice, 'N' | 'B' | 'R' | 'Q'> = {
  knight: 'N',
  bishop: 'B',
  rook: 'R',
  queen: 'Q',
};

const promotionOptions: PromotionChoice[] = ['queen', 'rook', 'bishop', 'knight'];


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
    const [moves, setMoves] = useState<Array<StoredMove & { color: PieceColor }>>([]);
    const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);
    // Pop-up Modal visibility state
    const [showModal, setShowModal] = useState<boolean>(false);

    // Post-Game Replay Engine States
    const [activeReplay, setActiveReplay] = useState<MatchRecord | null>(null);
    const [simulationTab, setSimulationTab] = useState<'score' | 'best' | 'worst'>('score');

    const [replayPositions, setReplayPositions] = useState<ReplayPosition[]>([]);
    const [currentPly, setCurrentPly] = useState<number>(-1); // -1 means initial puzzle state
    const [liveReplayScore, setLiveReplayScore] = useState<number>(0);
    const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
      if (typeof window === 'undefined') return 'dark';
      const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
      return isDarkMode ? 'dark' : 'light';
    });
    
    const buildMoveRecords = () => moves.map(({ notation, pieceFrom, pieceTo, promotion }) => ({
      notation,
      pieceFrom,
      pieceTo,
      ...(promotion ? { promotion } : {}),
    }));

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
        capturesByWhite: [],
        capturesByBlack: [],
      }];
      let runningWhiteAdvantage = 0;
      const appliedMoves: Array<StoredMove & { color: PieceColor }> = [];
      const capturesByWhite: string[] = [];
      const capturesByBlack: string[] = [];

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
            capturesByWhite: [...capturesByWhite],
            capturesByBlack: [...capturesByBlack],
          });
          break;
        }

        replayBoard = appliedMove.board;
        runningWhiteAdvantage += getReplayScoreDelta(replayMove.color, appliedMove.captured, getMoveNotation(replayMove.move));
        appliedMoves.push({ ...appliedMove.move, color: replayMove.color });
        const capturedValue = getCapturedPieceValue(appliedMove.captured);
        if (appliedMove.captured && capturedValue > 0) {
          if (replayMove.color === 'w') {
            capturesByWhite.push(appliedMove.captured);
          } else {
            capturesByBlack.push(appliedMove.captured);
          }
        }

        positions.push({
          board: replayBoard,
          moves: [...appliedMoves],
          score: userData.userSide === 'white' ? runningWhiteAdvantage : -runningWhiteAdvantage,
          capturesByWhite: [...capturesByWhite],
          capturesByBlack: [...capturesByBlack],
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

    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
    const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'] as const;

    const formatMoveNotation = (piece: string, to: number, promotion?: PromotionChoice) => {
      const kind = piece.split('_')[1];
      const toSquare = (files[to % 8] ?? '') + (ranks[Math.floor(to / 8)] ?? '');
      const baseNotation = (kind === 'pawn' ? '' : kind === 'knight' ? 'N' : kind?.[0]?.toUpperCase() ?? '') + toSquare;
      return promotion ? `${baseNotation}=${promotionLetterMap[promotion]}` : baseNotation;
    };

    const isPromotionMove = (piece: string, to: number) => {
      const kind = piece.split('_')[1];
      if (kind !== 'pawn') return false;

      const targetRow = Math.floor(to / 8);
      return piece.startsWith('white_') ? targetRow === 0 : targetRow === 7;
    };

    const commitMove = (from: number, to: number, promotion?: PromotionChoice) => {
      if (from === to) return;
      const pendingMove = pendingPromotion && pendingPromotion.from === from && pendingPromotion.to === to
        ? pendingPromotion
        : null;
      const piece = pendingMove?.movingPiece ?? board[from];
      if (!piece) return;
      // clear ghost immediately to avoid visual overlap during move
      setGhost(null);
      setTargetIndex(null);
      setDragging(null);
      const newBoard = board.slice();
      const destPiece = pendingMove?.capturedPiece ?? newBoard[to];
      const pieceColor = piece.startsWith('white_') ? 'w' : 'b';
      const promotedPiece = promotion ? `${piece.startsWith('white_') ? 'white' : 'black'}_${promotion}` : piece;
      newBoard[to] = promotedPiece;
      if (!pendingMove) {
        newBoard[from] = null;
      }
      setBoard(newBoard);
      setSelected(null);
      setPendingPromotion(null);

      setMoves((prev) => [...prev, {
        notation: formatMoveNotation(piece, to, promotion),
        color: pieceColor,
        pieceFrom: from,
        pieceTo: to,
        ...(promotion ? { promotion } : {}),
      }]);

      try {
        if (destPiece) {
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

    const requestMove = (from: number, to: number) => {
      if (from === to) return;
      if (userData.hasSubmitted || submitting || refreshing || showModal || moves.length >= 5) return;
      const piece = board[from];
      if (!piece) return;

      if (isPromotionMove(piece, to)) {
        setGhost(null);
        setTargetIndex(null);
        setDragging(null);
        const newBoard = board.slice();
        const capturedPiece = newBoard[to] ?? null;
        newBoard[to] = piece;
        newBoard[from] = null;
        setBoard(newBoard);
        setSelected(null);
        setPendingPromotion({
          from,
          to,
          color: piece.startsWith('white_') ? 'w' : 'b',
          movingPiece: piece,
          capturedPiece,
        });
        return;
      }

      commitMove(from, to);
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
  const whitePlayerName = gameMeta?.white?.split(',')[0] ?? 'White';
  const blackPlayerName = gameMeta?.black?.split(',')[0] ?? 'Black';

    const { gameData, userData, loading, submitMoves, submitting, selectSide, selectingSide, refreshing, playerCounts, simulationStats } = useCounter();
    const whiteStats = simulationStats.white;
    const blackStats = simulationStats.black;
    const pieceAssetsReady = usePieceAssetsReady();
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
      setPendingPromotion(null);
      setMoves([]);
      setGameMeta({ ...gameData.meta, turn: gameData.turn });
    }, [gameData]);

    React.useEffect(() => {
      if (!gameData || !userData.hasSubmitted || activeReplay) return;
      const defaultReplay = userData.bestMatch ?? userData.worstMatch;
      if (!defaultReplay) return;

      setSimulationTab('score');

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
        requestMove(selected, idx);
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
                requestMove(selected, toIdx);
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
          if (legal.includes(to)) requestMove(from, to);
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
        if (legal.includes(to)) requestMove(from, to);
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
          if (legal.includes(to)) requestMove(fromIndex, to);
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
    const isScoreOnlyTab = isReplayMode && simulationTab === 'score';
    const currentReplayMove = isReplayMode && currentPly >= 0
      ? currentReplayPosition?.moves[currentReplayPosition.moves.length - 1] ?? null
      : null;
    const replayHighlightFrom = currentReplayMove && currentReplayMove.pieceFrom >= 0
      ? currentReplayMove.pieceFrom
      : null;
    const replayHighlightTo = currentReplayMove && currentReplayMove.pieceTo >= 0
      ? currentReplayMove.pieceTo
      : null;
    const [viewportWidth, setViewportWidth] = useState<number>(() =>
      typeof window === 'undefined' ? 1024 : window.innerWidth
    );
    const isDesktopLayout = viewportWidth >= 1100;
    const isDesktopPopupLayout = isDesktopLayout && viewportWidth < 1450;
    const desktopBoardWidth = isReplayMode
      ? (isDesktopPopupLayout ? 500 : 620)
      : 620;
    const isGameClosed = Boolean(gameData?.closesAt && Date.now() >= gameData.closesAt);
    const theme = themeMode === 'dark'
      ? {
          appBg: '#F6F1E6',
          panelBg: '#FFFFFF',
          cardBg: '#FFFFFF',
          textPrimary: '#0E0E0E',
          textSecondary: '#121212',
          textMuted: '#3B3B3B',
          borderSoft: '#000000',
          boardDark: '#B07C49',
          boardLight: '#FFF7DC',
          overlay: 'rgba(15,15,15,0.72)',
        }
      : {
          appBg: '#FFFDF5',
          panelBg: '#FFFFFF',
          cardBg: '#FFFFFF',
          textPrimary: '#0E0E0E',
          textSecondary: '#121212',
          textMuted: '#3B3B3B',
          borderSoft: '#000000',
          boardDark: '#B07C49',
          boardLight: '#FFF7DC',
          overlay: 'rgba(18,16,13,0.6)',
        };

    React.useEffect(() => {
      const onResize = () => setViewportWidth(window.innerWidth);
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    }, []);

    React.useEffect(() => {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const syncThemeWithPreference = (event?: MediaQueryListEvent) => {
        const prefersDark = event ? event.matches : mediaQuery.matches;
        setThemeMode(prefersDark ? 'dark' : 'light');
      };

      syncThemeWithPreference();
      mediaQuery.addEventListener('change', syncThemeWithPreference);
      return () => mediaQuery.removeEventListener('change', syncThemeWithPreference);
    }, []);

    React.useEffect(() => {
      document.body.style.backgroundColor = theme.appBg;
      document.body.style.color = theme.textSecondary;
    }, [theme.appBg, theme.textSecondary]);

    React.useEffect(() => {
      if (showModal && !submitting && !refreshing && userData.hasSubmitted) {
        setShowModal(false);
      }
    }, [showModal, submitting, refreshing, userData.hasSubmitted]);

    const autoSubmitTriggeredRef = useRef(false);

    React.useEffect(() => {
      if (userData.hasSubmitted) {
        autoSubmitTriggeredRef.current = true;
        return;
      }

      if (moves.length < 5) {
        autoSubmitTriggeredRef.current = false;
        return;
      }

      if (autoSubmitTriggeredRef.current || submitting || refreshing || showModal || pendingPromotion) {
        return;
      }

      autoSubmitTriggeredRef.current = true;

      const submit = async () => {
        setShowModal(true);
        const success = await submitMoves(buildMoveRecords());
        if (success) {
          setSelected(null);
          setLegalMoves([]);
        } else {
          setShowModal(false);
          autoSubmitTriggeredRef.current = false;
        }
      };

      void submit();
    }, [moves, userData.hasSubmitted, submitting, refreshing, showModal, pendingPromotion, submitMoves]);

    const showInitialLoader = loading && !userData.userSide;
    const showBoardLoadingOverlay = Boolean(userData.userSide) && (selectingSide || loading || !pieceAssetsReady);
    const showScoreboardLoader = showModal || submitting || refreshing;

    const getReplayCaptureForSide = (side: PieceColor) => {
      if (!currentReplayPosition) return [];
      return side === 'w' ? currentReplayPosition.capturesByWhite : currentReplayPosition.capturesByBlack;
    };

    const renderReplayCaptureBadge = (side: PieceColor) => {
      if (!isReplayMode) return null;
      const captures = getReplayCaptureForSide(side);
      if (captures.length === 0) return null;

      return (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            marginLeft: '8px',
            background: themeMode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(31,29,25,0.08)',
            border: `1px solid ${theme.borderSoft}`,
            borderRadius: '999px',
            padding: '2px 6px',
            fontSize: '11px',
            fontWeight: 700,
            color: theme.textPrimary,
          }}
        >
          {captures.map((piece, index) => (
            <img
              key={`${side}-cap-${index}-${piece}`}
              src={`/pieces/${piece}.png`}
              alt={piece}
              style={{ width: 13, height: 13 }}
            />
          ))}
        </div>
      );
    };
    const showOpponentPlaceholder =
      (gameMeta?.turn === 'b' && userData.userSide === 'white') ||
      (gameMeta?.turn === 'w' && userData.userSide === 'black');
    if (showInitialLoader) {
    return (
      <LoadingPanel
        title="Loading match"
        detail="Preparing the daily position and player state before side selection opens."
      />
    );
  }
    if (isGameClosed && !userData.hasSubmitted) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', background: theme.appBg, color: theme.textSecondary, fontFamily: 'sans-serif', padding: 20
      }}>
        <div style={{
          background: theme.panelBg,
          padding: '28px',
          borderRadius: '18px',
          boxShadow: '0 18px 40px rgba(0,0,0,0.18)',
          maxWidth: '460px',
          width: '100%',
          textAlign: 'center',
          border: `1px solid ${theme.borderSoft}`,
        }}>
          <h2 style={{ margin: '0 0 10px 0', color: theme.textPrimary, fontSize: '28px', fontWeight: 800 }}>Game Closed</h2>
          <p style={{ margin: 0, color: theme.textMuted, fontSize: '14px', lineHeight: 1.5 }}>
            This puzzle was active for 24 hours and can no longer be played.
          </p>
        </div>
      </div>
    );
  }
    if (!userData.userSide) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', background: theme.appBg, color: theme.textSecondary, fontFamily: 'sans-serif', padding: 20
      }}>
        <div style={{
          background: theme.panelBg,
          padding: '20px',
          borderRadius: '0px',
          boxShadow: '8px 8px 0 0 #000',
          maxWidth: '700px',
          width: '100%',
          textAlign: 'center',
          border: `4px solid ${theme.borderSoft}`,
        }}>
          <h2 style={{ margin: '0 0 18px 0', color: theme.textPrimary, fontSize: '28px', fontWeight: 800 }}>Choose Your Side</h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px' }}>
            <button 
              onClick={() => { selectSide('white');}}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
                padding: '22px 16px',
                background: themeMode === 'dark' ? '#f6f0e4' : '#fffdf7',
                border: '2px solid rgba(177, 159, 124, 0.38)',
                borderRadius: '16px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 700,
                color: '#262421',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.75), 0 10px 22px rgba(0,0,0,0.08)',
              }}
            >
              <div style={{
                width: '100%',
                borderRadius: '12px',
                background: 'rgba(183, 198, 156, 0.55)',
                padding: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <img
                  src="/pieces/white_king.png"
                  alt="White king"
                  style={{ width: '72px', height: '72px', objectFit: 'contain' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#706e6b' }}>White</span>
                <span style={{ fontSize: '24px', fontWeight: 800 }}>{whitePlayerName}</span>
                <span style={{ fontSize: '13px', color: '#706e6b' }}>{playerCounts?.white || 0} Players</span>
              </div>
            </button>

            <button 
              onClick={() => {selectSide('black');}}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
                padding: '22px 16px',
                background: '#1f1d1a',
                border: '2px solid rgba(129, 182, 76, 0.28)',
                borderRadius: '16px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 700,
                color: '#ffffff',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 10px 22px rgba(0,0,0,0.2)',
              }}
            >
              <div style={{
                width: '100%',
                borderRadius: '12px',
                background: 'rgba(71, 100, 44, 0.73)',
                padding: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <img
                  src="/pieces/black_king.png"
                  alt="Black king"
                  style={{ width: '72px', height: '72px', objectFit: 'contain' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#bababa' }}>Black</span>
                <span style={{ fontSize: '24px', fontWeight: 800 }}>{blackPlayerName}</span>
                <span style={{ fontSize: '13px', color: '#bababa' }}>{playerCounts?.black || 0} Players</span>
              </div>
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
      backgroundColor: theme.appBg,
      backgroundImage: 'radial-gradient(#000 1px, transparent 1px)',
      backgroundSize: '24px 24px',
      color: theme.textSecondary,
      padding: isReplayMode && isDesktopLayout ? '8px 12px' : '16px',
      maxWidth: isReplayMode && isDesktopLayout ? 'min(1500px, 96vw)' : (isReplayMode ? '1080px' : '1000px'),
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: isReplayMode ? '8px' : '16px',
      boxSizing: 'border-box',
      width: '100%',
    }}
    onMouseDown={onOutsidePointerDown}
    onTouchStart={onOutsidePointerDown}
    onTouchMove={onTouchMove}
    onTouchEnd={onTouchEnd}
  >
    {/* ================= SUCCESS SCORE POP-UP OVERLAY ================= */}
    {showScoreboardLoader && (
      <LoadingPanel
        title="Generating scoreboard"
        detail="Your moves were saved. Refreshing match results and simulation totals before the dashboard opens."
      />
    )}

    {pendingPromotion && (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 10002,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(15, 15, 15, 0.52)',
          backdropFilter: 'blur(4px)',
          padding: '20px',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            padding: '18px',
            borderRadius: '16px',
            background: 'rgba(24, 23, 20, 0.98)',
            border: '1px solid rgba(129, 182, 76, 0.35)',
            boxShadow: '0 14px 32px rgba(0,0,0,0.45)',
            minWidth: 'min(320px, 92vw)',
          }}
        >
          <div style={{ textAlign: 'center', color: '#f5f1e8', fontSize: '18px', fontWeight: 800 }}>
            Choose promotion
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
            {promotionOptions.map((option) => {
              const piecePrefix = pendingPromotion.color === 'w' ? 'white' : 'black';
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => commitMove(pendingPromotion.from, pendingPromotion.to, option)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '60px',
                    height: '60px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: 'rgba(255,255,255,0.06)',
                    cursor: 'pointer',
                    padding: 0,
                    margin: '0 auto',
                  }}
                >
                  <img
                    src={`/pieces/${piecePrefix}_${option}.png`}
                    alt={option}
                    style={{ width: '42px', height: '42px', objectFit: 'contain' }}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    )}

    {isReplayMode && (
      <div style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{
            margin: 0,
            display: 'inline-block',
            background: '#FFD93D',
            border: '4px solid #000',
            boxShadow: '4px 4px 0 0 #000',
            padding: '6px 16px',
            fontSize: '34px',
            fontWeight: 900,
            lineHeight: 1,
            textTransform: 'uppercase',
            letterSpacing: '-0.04em',
            transform: 'rotate(-0.6deg)',
            color: '#000',
          }}>
            ShadowChess
          </h1>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '6px',
        }}>
        <button
          type="button"
          onClick={() => {
            setSimulationTab('score');
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setSimulationTab('score');
          }}
          style={{
            border: '3px solid #000',
            background: simulationTab === 'score' ? '#FFD93D' : '#FFFFFF',
            color: '#000',
            borderRadius: '0px',
            padding: '8px 8px',
            fontSize: '12px',
            fontWeight: 800,
            cursor: 'pointer',
            boxShadow: simulationTab === 'score' ? '3px 3px 0 0 #000' : 'none',
          }}
        >
          Score
        </button>
        <button
          type="button"
          onClick={() => {
            setSimulationTab('best');
            if (userData.bestMatch) loadReplayGame(userData.bestMatch);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setSimulationTab('best');
            if (userData.bestMatch) loadReplayGame(userData.bestMatch);
          }}
          style={{
            border: '3px solid #000',
            background: simulationTab === 'best' ? '#C4B5FD' : '#FFFFFF',
            color: '#000',
            borderRadius: '0px',
            padding: '8px 8px',
            fontSize: '12px',
            fontWeight: 800,
            cursor: 'pointer',
            boxShadow: simulationTab === 'best' ? '3px 3px 0 0 #000' : 'none',
          }}
        >
          Best Game
        </button>
        <button
          type="button"
          onClick={() => {
            setSimulationTab('worst');
            if (userData.worstMatch) loadReplayGame(userData.worstMatch);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setSimulationTab('worst');
            if (userData.worstMatch) loadReplayGame(userData.worstMatch);
          }}
          style={{
            border: '3px solid #000',
            background: simulationTab === 'worst' ? '#FF6B6B' : '#FFFFFF',
            color: '#000',
            borderRadius: '0px',
            padding: '8px 8px',
            fontSize: '12px',
            fontWeight: 800,
            cursor: 'pointer',
            boxShadow: simulationTab === 'worst' ? '3px 3px 0 0 #000' : 'none',
          }}
        >
          Worst Game
        </button>
        </div>
      </div>
    )}

    {/* ================= THIN INLINE MOVE LEDGER ================= */}
    {!isScoreOnlyTab && (
    <div style={{
      width: '100%',
      maxWidth: isReplayMode ? '1080px' : '1000px',
      background: theme.cardBg,
      padding: isReplayMode ? '5px 10px' : '6px 16px',
      borderRadius: '6px',
      fontSize: isReplayMode ? '12px' : '13px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      overflowX: 'auto',
      whiteSpace: 'nowrap',
      border: `1px solid ${theme.borderSoft}`,
      boxSizing: 'border-box',
      color: theme.textPrimary
    }}>
      <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: theme.textMuted, marginRight: '8px' }}>Moves:</span>

      {isReplayMode ? (
        <>
          <span style={{ color: '#81b64c', fontWeight: 600, marginRight: '8px' }}>
            vs u/{activeReplay?.opponent}
          </span>
          {moves.length > 0 ? moves.map((m, idx) => (
            <span
              key={`${m.color}-${idx}-${m.notation}`}
              style={{
                color: idx === currentPly ? theme.textPrimary : theme.textSecondary,
                fontWeight: idx === currentPly ? 800 : 500,
                marginRight: '6px',
              }}
            >
              <span style={{ color: '#706e6b' }}>{Math.floor(idx / 2) + 1}{m.color === 'b' ? '...' : '.'}</span> {m.notation}
            </span>
          )) : (
            <span style={{ color: theme.textMuted }}>Initial position</span>
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
    )}

    {isScoreOnlyTab && (
  <div style={{
    width: '100%',
    background: 'rgba(23, 23, 23, 0.95)',
    border: '2px solid rgba(212,167,44,0.55)',
    borderRadius: '12px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    fontFamily: '"Oswald", sans-serif',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    maxWidth: '800px', // Example constraints
    margin: 'auto'
  }}>
    {/* Top Header Row (Logo placeholders, main scores) */}
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', alignItems: 'stretch' }}>
      
      {/* Left 'White' Team Card */}
<div style={{ 
  background: 'rgba(71, 100, 44, 0.73)', 
  
  color: '#000', 
  display: 'flex', 
  alignItems: 'center', 
  justifyContent: 'center',
  padding: '20px'
}}>
  <img
    src="/pieces/white_king.png"
    alt="White king"
    style={{ width: '72px', height: '72px', objectFit: 'contain' }}
  />
</div>


      {/* Center Scores and Names */}
      <div style={{ background: '#111', color: '#fff', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', padding: '12px 20px', textAlign: 'center', fontSize: '16px', fontWeight: 700, color: '#aaa', textTransform: 'uppercase' }}>
          <div>White</div>
          <div>Black</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', padding: '10px 20px', alignItems: 'center' }}>
          <div style={{ textAlign: 'center', fontSize: '82px', fontWeight: 900 }}>{whiteStats.totalScore}</div>
          <div style={{ textAlign: 'center', fontSize: '82px', fontWeight: 900 }}>{blackStats.totalScore}</div>
        </div>
      </div>

      {/* Right 'Black' Team Card */}
      <div style={{ 
        
        background: 'rgba(71, 100, 44, 0.73)', 
        
        color: '#000', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        padding: '20px'
      }}>
        <img
          src="/pieces/black_king.png"
          alt="Black king"
          style={{ width: '72px', height: '72px', objectFit: 'contain' }}
        />
      </div>
    </div>

    {/* Details Section (Metrics list) */}
    <div style={{ background: '#222', color: '#eee', fontSize: '16px' }}>
      
      {/* Row Helper Component */}
      {[
        { label: 'Players', white: whiteStats.players, black: blackStats.players, accent: '#81b64c' },
        { label: 'Illegal moves', white: whiteStats.illegalMoves, black: blackStats.illegalMoves, accent: '#81b64c' },
        { label: 'Captures', white: whiteStats.captures, black: blackStats.captures, accent: '#81b64c' },
      ].map((stat, i) => (
        <div key={i} style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1.5fr 1fr', 
          alignItems: 'center', 
          textAlign: 'center',
          borderTop: '1px solid #333'
        }}>
          <div style={{ padding: '16px 20px', fontSize: '24px', fontWeight: 700, color: '#fff' }}>{stat.white}</div>
          <div style={{ 
            padding: '12px 20px', 
            background: `${stat.accent}22`, 
            color: stat.accent,
            fontWeight: 800, 
            textTransform: 'none',
            letterSpacing: '0.4px',
            fontSize: '16px',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderLeft: `1px solid ${stat.accent}55`,
            borderRight: `1px solid ${stat.accent}55`,
          }}>{stat.label}</div>
          <div style={{ padding: '16px 20px', fontSize: '24px', fontWeight: 700, color: '#fff' }}>{stat.black}</div>
        </div>
      ))}
    </div>

    {/* Separate User Score Section at Bottom */}
    <div style={{
      background: 'rgba(255, 255, 255, 0.04)',
      padding: '20px',
      borderTop: '2px solid rgba(212,167,44,0.35)',
      textAlign: 'center',
      marginTop: 'auto',
      borderRadius: '0 0 12px 12px'
    }}>
      <div style={{
        color: '#f2c94c',
        fontSize: '16px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '1px',
        marginBottom: '4px'
      }}>Your Score</div>
      <div style={{
        color: '#fff',
        fontSize: '44px',
        fontWeight: 900
      }}>{userData?.score ?? 0}</div>
    </div>
  </div>
)}

    {/* ================= MAIN RESPONSIVE CONTAINER ================= */}
    {!isScoreOnlyTab && (
    <div style={{ 
      display: 'flex', 
      flexDirection: isDesktopLayout ? 'row' : 'column', 
      flexWrap: 'nowrap',
      gap: isReplayMode ? '8px' : '16px', 
      width: '100%', 
      justifyContent: 'center',
      alignItems: 'flex-start'
    }}>
      
      {/* LEFT SIDE: BOARDS & PLAYERS */}
      <div style={{ 
        flex: isReplayMode && isDesktopLayout
          ? `0 0 ${desktopBoardWidth}px`
          : (isReplayMode ? '1 1 760px' : '1 1 400px'), 
        maxWidth: isReplayMode
          ? (isDesktopLayout ? `${desktopBoardWidth}px` : '100%')
          : (isDesktopLayout ? `${desktopBoardWidth}px` : '500px'), 
        width: '100%', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: isReplayMode ? '6px' : '8px',
        margin: isReplayMode ? '0 auto' : undefined,
      }}>
        
        {/* BLOCK 1: OPPONENT/TOP PLAYER PANEL */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: '8px 12px', 
          background: theme.panelBg, 
          borderRadius: '6px',
          border: `1px solid ${theme.borderSoft}`,
          fontSize: '14px',
          color: theme.textPrimary
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
            <div style={badgeStyle(userData.userSide === 'white' ? '#000000' : '#ffffff')} />
            <span>{isReplayMode ? `u/${activeReplay?.opponent}` : 'ShadowChess GM'}</span>
            {renderReplayCaptureBadge(opponentColor)}
            <span style={{ fontSize: '11px', color: theme.textMuted, fontWeight: 400 }}>
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
            maxWidth: isDesktopLayout ? `${desktopBoardWidth}px` : undefined,
            aspectRatio: '1 / 1',
            display: 'grid',
            gridTemplateColumns: 'repeat(8, 1fr)',
            gridTemplateRows: 'repeat(8, 1fr)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            borderRadius: '4px',
            overflow: 'hidden',
            position: 'relative',
            margin: isReplayMode && isDesktopLayout ? '0 auto' : undefined,
          }} 
          onDragOver={userData.hasSubmitted ? undefined : onBoardDragOver} 
          onDrop={userData.hasSubmitted ? undefined : onBoardDrop}
        >
          {showBoardLoadingOverlay && !showScoreboardLoader && (
            <LoadingPanel
              title={selectingSide ? 'Entering board' : 'Rendering board'}
              detail={selectingSide
                ? 'Saving your side and preparing the live board.'
                : 'Loading piece assets and finalizing the board view.'}
              overlay
            />
          )}
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
            const bg = isDark ? theme.boardDark : theme.boardLight;
            const piece = board[i];
            const isReplayHighlightedSquare = i === replayHighlightFrom || i === replayHighlightTo;
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
                      if (legal.includes(i)) requestMove(from, i);
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
                  outline: isReplayHighlightedSquare ? '3px solid rgba(212, 167, 44, 0.95)' : undefined,
                  outlineOffset: isReplayHighlightedSquare ? '-3px' : undefined,
                  boxShadow: isReplayHighlightedSquare
                    ? 'inset 0 0 24px rgba(255, 221, 118, 0.42), 0 0 12px rgba(255, 221, 118, 0.16)'
                    : undefined,
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
          background: theme.panelBg, 
          borderRadius: '6px',
          border: `1px solid ${theme.borderSoft}`,
          fontSize: '14px',
          color: theme.textPrimary
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
            <div style={badgeStyle(userData.userSide === 'black' ? '#000000' : '#ffffff')} />
            <span>u/{userData.username ?? 'anonymous'}</span>
            {renderReplayCaptureBadge(userColor)}
            <span style={{ fontSize: '11px', color: theme.textMuted, fontWeight: 400 }}>
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
              color: theme.textPrimary,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              background: theme.cardBg,
              border: `1px solid ${theme.borderSoft}`,
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

      {!userData.hasSubmitted && (
      <div style={{ 
        flex: '1 1 280px',
        maxWidth: '500px',
        width: '100%',
        display: 'flex', 
        flexDirection: 'column', 
        gap: '8px',
        background: theme.panelBg, 
        padding: '16px', 
        borderRadius: '8px',
        boxShadow: '0 6px 18px rgba(0,0,0,0.3)',
        color: theme.textSecondary,
        boxSizing: 'border-box',
        border: `1px solid ${theme.borderSoft}`
      }}>
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            borderRadius: '6px',
            padding: '10px 12px',
            border: `1px solid ${theme.borderSoft}`,
          }}>
            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', color: theme.textMuted }}>
              Move Progress
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: theme.textPrimary, lineHeight: 1.2 }}>
              Move: {Math.min(moves.length + 1, 5)}/5
            </div>
            <div style={{ fontSize: '12px', marginTop: '6px', color: theme.textMuted }}>
              Your game auto-submits after move 5.
            </div>
          </div>
      </div>
      )}

    </div>
    )}

    {/* GHOST DRAG ELEMENT */}
    {ghost && (
      <img src={`/pieces/${ghost.piece}.png`} alt={ghost.piece} style={{ position: 'fixed', left: ghost.x, top: ghost.y, pointerEvents: 'none', transform: 'translate(-50%, -60%)', width: square * 0.96 * (ghost.scale ?? 1), height: square * 0.96 * (ghost.scale ?? 1), zIndex: 9999 }} />
    )}
  </div>
);
    
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <>
      <style>{'@keyframes asyncchess-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }'}</style>
      <Chessboard />
    </>
  </StrictMode>
);
