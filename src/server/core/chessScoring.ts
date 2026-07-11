import type { MoveInput, StoredMove } from '../../shared/api';

type GameScore = {
  white: number;
  black: number;
};

type PieceColor = 'w' | 'b';
type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

type Piece = {
  color: PieceColor;
  type: PieceType;
};

type Board = Array<Piece | null>;

type ParsedMove = {
  pieceType: PieceType;
  to: number;
  promotion?: PieceType;
  castleSide?: 'king' | 'queen';
};

type AppliedMove = {
  captured: Piece | null;
};

type OrderedMove = {
  color: PieceColor;
  move?: MoveInput;
};

const pieceValues: Record<PieceType, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 15,
};

const promotionValues: Partial<Record<PieceType, number>> = {
  n: 3,
  b: 3,
  r: 5,
  q: 9,
};

const pieceLetters: Record<string, PieceType> = {
  N: 'n',
  B: 'b',
  R: 'r',
  Q: 'q',
  K: 'k',
};

const fenPieces: Record<string, Piece> = {
  P: { color: 'w', type: 'p' },
  N: { color: 'w', type: 'n' },
  B: { color: 'w', type: 'b' },
  R: { color: 'w', type: 'r' },
  Q: { color: 'w', type: 'q' },
  K: { color: 'w', type: 'k' },
  p: { color: 'b', type: 'p' },
  n: { color: 'b', type: 'n' },
  b: { color: 'b', type: 'b' },
  r: { color: 'b', type: 'r' },
  q: { color: 'b', type: 'q' },
  k: { color: 'b', type: 'k' },
};

const boardIndex = (rankIndex: number, fileIndex: number) => rankIndex * 8 + fileIndex;

const isPieceType = (value: string): value is PieceType =>
  value === 'p' || value === 'n' || value === 'b' || value === 'r' || value === 'q' || value === 'k';

const isStoredMove = (move: MoveInput): move is StoredMove =>
  typeof move !== 'string' &&
  typeof move.notation === 'string' &&
  typeof move.pieceFrom === 'number' &&
  typeof move.pieceTo === 'number';

const parseFenBoard = (fen: string): Board => {
  const board: Board = Array(64).fill(null);
  const placement = fen.trim().split(/\s+/)[0] ?? '';
  const rows = placement.split('/');

  for (let rankIndex = 0; rankIndex < 8; rankIndex++) {
    const row = rows[rankIndex] ?? '';
    let fileIndex = 0;

    for (const token of row) {
      if (/\d/.test(token)) {
        fileIndex += Number(token);
        continue;
      }

      const piece = fenPieces[token];
      if (piece && fileIndex < 8) {
        board[boardIndex(rankIndex, fileIndex)] = { ...piece };
      }
      fileIndex++;
    }
  }

  return board;
};

const getStartingTurn = (fen: string): PieceColor => {
  const active = fen.trim().split(/\s+/)[1];
  return active === 'b' ? 'b' : 'w';
};

const sanitizeMove = (move: string) =>
  move
    .trim()
    .replace(/^\d+\.(\.\.)?/, '')
    .replace(/[+#?!]+$/g, '')
    .trim();

const squareToIndex = (file: string, rank: string) => {
  const fileIndex = file.charCodeAt(0) - 'a'.charCodeAt(0);
  const rankNumber = Number(rank);

  if (fileIndex < 0 || fileIndex > 7 || rankNumber < 1 || rankNumber > 8) {
    return null;
  }

  return boardIndex(8 - rankNumber, fileIndex);
};

const parseMove = (move: string): ParsedMove | null => {
  const cleanMove = sanitizeMove(move);
  const normalizedCastle = cleanMove.replace(/0/g, 'O');

  if (normalizedCastle === 'O-O') {
    return { pieceType: 'k', to: -1, castleSide: 'king' };
  }

  if (normalizedCastle === 'O-O-O') {
    return { pieceType: 'k', to: -1, castleSide: 'queen' };
  }

  const promotionMatch = cleanMove.match(/=([NBRQ])$/);
  const promotion = promotionMatch ? pieceLetters[promotionMatch[1] ?? ''] : undefined;
  const withoutPromotion = cleanMove.replace(/=([NBRQ])$/, '');
  const destinationMatch = withoutPromotion.match(/([a-h])([1-8])$/);

  if (!destinationMatch) {
    return null;
  }

  const to = squareToIndex(destinationMatch[1] ?? '', destinationMatch[2] ?? '');
  if (to === null) {
    return null;
  }

  const firstToken = withoutPromotion[0] ?? '';
  const pieceType = pieceLetters[firstToken] ?? 'p';

  return {
    pieceType,
    to,
    promotion,
  };
};

const rowOf = (index: number) => Math.floor(index / 8);
const colOf = (index: number) => index % 8;

const isReachable = (piece: Piece, from: number, to: number) => {
  if (from === to) return false;

  const fromRow = rowOf(from);
  const fromCol = colOf(from);
  const toRow = rowOf(to);
  const toCol = colOf(to);
  const rowDelta = toRow - fromRow;
  const colDelta = toCol - fromCol;
  const absRowDelta = Math.abs(rowDelta);
  const absColDelta = Math.abs(colDelta);

  if (piece.type === 'r') {
    return rowDelta === 0 || colDelta === 0;
  }

  if (piece.type === 'b') {
    return absRowDelta === absColDelta;
  }

  if (piece.type === 'q') {
    return rowDelta === 0 || colDelta === 0 || absRowDelta === absColDelta;
  }

  if (piece.type === 'n') {
    return (absRowDelta === 2 && absColDelta === 1) || (absRowDelta === 1 && absColDelta === 2);
  }

  if (piece.type === 'k') {
    return absRowDelta <= 1 && absColDelta <= 1;
  }

  const direction = piece.color === 'w' ? -1 : 1;
  const startingRow = piece.color === 'w' ? 6 : 1;

  if (colDelta === 0 && rowDelta === direction) {
    return true;
  }

  if (colDelta === 0 && fromRow === startingRow && rowDelta === direction * 2) {
    return true;
  }

  return absColDelta === 1 && rowDelta === direction;
};

const inferMoveSource = (board: Board, color: PieceColor, move: ParsedMove) => {
  for (let index = 0; index < board.length; index++) {
    const piece = board[index];

    if (!piece || piece.color !== color || piece.type !== move.pieceType) {
      continue;
    }

    if (isReachable(piece, index, move.to)) {
      return index;
    }
  }

  return null;
};

const applyCastle = (board: Board, color: PieceColor, side: 'king' | 'queen'): AppliedMove | null => {
  const row = color === 'w' ? 7 : 0;
  const kingFrom = boardIndex(row, 4);
  const rookFrom = boardIndex(row, side === 'king' ? 7 : 0);
  const kingTo = boardIndex(row, side === 'king' ? 6 : 2);
  const rookTo = boardIndex(row, side === 'king' ? 5 : 3);
  const king = board[kingFrom];
  const rook = board[rookFrom];

  if (!king || !rook || king.color !== color || rook.color !== color || king.type !== 'k' || rook.type !== 'r') {
    return null;
  }

  const captured = board[kingTo] ?? null;
  board[kingTo] = king;
  board[kingFrom] = null;
  board[rookTo] = rook;
  board[rookFrom] = null;

  return { captured };
};

const applyStoredMove = (board: Board, color: PieceColor, move: StoredMove): AppliedMove | null => {
  if (
    move.pieceFrom < 0 ||
    move.pieceFrom > 63 ||
    move.pieceTo < 0 ||
    move.pieceTo > 63 ||
    move.pieceFrom === move.pieceTo
  ) {
    return null;
  }

  const movingPiece = board[move.pieceFrom];
  if (!movingPiece || movingPiece.color !== color) {
    return null;
  }

  const parsedMove = parseMove(move.notation);
  const captured = board[move.pieceTo] ?? null;
  board[move.pieceTo] = parsedMove?.promotion && isPieceType(parsedMove.promotion)
    ? { color, type: parsedMove.promotion }
    : movingPiece;
  board[move.pieceFrom] = null;

  return { captured };
};

const applyMove = (board: Board, color: PieceColor, moveInput: MoveInput): AppliedMove | null => {
  if (isStoredMove(moveInput)) {
    return applyStoredMove(board, color, moveInput);
  }

  const moveText = moveInput;
  const move = parseMove(moveText);

  if (!move) {
    return null;
  }

  if (move.castleSide) {
    return applyCastle(board, color, move.castleSide);
  }

  const from = inferMoveSource(board, color, move);

  if (from === null) {
    return null;
  }

  const movingPiece = board[from];
  if (!movingPiece) {
    return null;
  }

  const captured = board[move.to] ?? null;
  board[move.to] = move.promotion && isPieceType(move.promotion)
    ? { color, type: move.promotion }
    : movingPiece;
  board[from] = null;

  return { captured };
};

const scoreCapture = (captured: Piece | null, promotion?: PieceType) => {
  let score = captured ? pieceValues[captured.type] : 0;

  if (promotion) {
    score += promotionValues[promotion] ?? 0;
  }

  return score;
};

/**
 * Calculates a zero-sum score from a custom midgame FEN position.
 * Kings may move into check and may be captured; check/checkmate is not enforced.
 */
export function calculateMidgameZeroSumScore(
  initialFen: string,
  whiteMoves: MoveInput[],
  blackMoves: MoveInput[]
): GameScore {
  const board = parseFenBoard(initialFen);
  let relativeAdvantage = 0;
  const startingTurn = getStartingTurn(initialFen);

  for (let round = 0; round < 5; round++) {
    const orderedMoves: OrderedMove[] = startingTurn === 'w'
      ? [
          { color: 'w', move: whiteMoves[round] },
          { color: 'b', move: blackMoves[round] },
        ]
      : [
          { color: 'b', move: blackMoves[round] },
          { color: 'w', move: whiteMoves[round] },
        ];

    for (const orderedMove of orderedMoves) {
      if (!orderedMove.move) {
        relativeAdvantage += orderedMove.color === 'w' ? -15 : 15;
        return { white: relativeAdvantage, black: -relativeAdvantage };
      }

      const moveNotation = typeof orderedMove.move === 'string'
        ? orderedMove.move
        : orderedMove.move.notation;
      const parsedMove = parseMove(moveNotation);
      const appliedMove = applyMove(board, orderedMove.color, orderedMove.move);

      if (!appliedMove) {
        relativeAdvantage += orderedMove.color === 'w' ? -15 : 15;
        return { white: relativeAdvantage, black: -relativeAdvantage };
      }

      const swing = scoreCapture(appliedMove.captured, parsedMove?.promotion);
      relativeAdvantage += orderedMove.color === 'w' ? swing : -swing;
    }
  }

  return {
    white: relativeAdvantage,
    black: -relativeAdvantage,
  };
}
