// shared/chess.ts

export type Side = 'w' | 'b';

export type Piece =
  | 'white_pawn'
  | 'white_rook'
  | 'white_knight'
  | 'white_bishop'
  | 'white_queen'
  | 'white_king'
  | 'black_pawn'
  | 'black_rook'
  | 'black_knight'
  | 'black_bishop'
  | 'black_queen'
  | 'black_king'
  | null;

export function pieceSide(piece: Piece): Side | null {
  if (!piece) return null;
  return piece.startsWith('white_') ? 'w' : 'b';
}

export function generateRandomBoard(): Piece[] {
  // Standard chess starting position.
  // Replace this later if you want randomized boards.
  return [
    "black_rook",
    "black_knight",
    "black_bishop",
    "black_queen",
    "black_king",
    "black_bishop",
    "black_knight",
    "black_rook",

    ...Array(8).fill("black_pawn"),

    ...Array(32).fill(null),

    ...Array(8).fill("white_pawn"),

    "white_rook",
    "white_knight",
    "white_bishop",
    "white_queen",
    "white_king",
    "white_bishop",
    "white_knight",
    "white_rook",
  ] as Piece[];
}

export function getLegalMoves(
  board: Piece[],
  from: number
): number[] {
  const piece = board[from];
  if (!piece) return [];

  const color = pieceSide(piece)!;

  const moves: number[] = [];

  const r0 = Math.floor(from / 8);
  const c0 = from % 8;

  const inBounds = (r: number, c: number) =>
    r >= 0 && r < 8 && c >= 0 && c < 8;

  const idx = (r: number, c: number) => r * 8 + c;

  const isEnemy = (target: Piece | null) =>
    target &&
    (color === "w"
      ? target.startsWith("black_")
      : target.startsWith("white_"));

  const addSlide = (dr: number, dc: number) => {
    let r = r0 + dr;
    let c = c0 + dc;

    while (inBounds(r, c)) {
      const square = idx(r, c);
      const target = board[square];

      if (!target) {
        moves.push(square);
      } else {
        if (isEnemy(target)) {
          moves.push(square);
        }
        break;
      }

      r += dr;
      c += dc;
    }
  };

  const kind = piece.split("_")[1];

  switch (kind) {
    case "rook":
      addSlide(-1, 0);
      addSlide(1, 0);
      addSlide(0, -1);
      addSlide(0, 1);
      break;

    case "bishop":
      addSlide(-1, -1);
      addSlide(-1, 1);
      addSlide(1, -1);
      addSlide(1, 1);
      break;

    case "queen":
      addSlide(-1, 0);
      addSlide(1, 0);
      addSlide(0, -1);
      addSlide(0, 1);

      addSlide(-1, -1);
      addSlide(-1, 1);
      addSlide(1, -1);
      addSlide(1, 1);
      break;

    case "knight": {
      const deltas = [
        [-2, -1],
        [-2, 1],
        [-1, -2],
        [-1, 2],
        [1, -2],
        [1, 2],
        [2, -1],
        [2, 1],
      ];

      for (const [dr, dc] of deltas) {
        if (dr === null || dc === null) continue;
        const r = r0 + dr!;
        const c = c0 + dc!;

        if (!inBounds(r, c)) continue;

        const square = idx(r, c);
        const target = board[square];

        if (!target || isEnemy(target)) {
        moves.push(square);
        }
      }

      break;
    }

    case "king":
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;

          const r = r0 + dr;
          const c = c0 + dc;

          if (!inBounds(r, c)) continue;

          const square = idx(r, c);
          const target = board[square];

          if (!target || isEnemy(target)) {
            moves.push(square);
          }
        }
      }
      break;

    case "pawn": {
      const direction = color === "w" ? -1 : 1;

      const oneStep = r0 + direction;

      if (inBounds(oneStep, c0)) {
        const square = idx(oneStep, c0);

        if (!board[square]) {
          moves.push(square);

          const startRank = color === "w" ? 6 : 1;
          const twoStep = r0 + direction * 2;

          if (r0 === startRank) {
            const square2 = idx(twoStep, c0);

            if (!board[square2]) {
              moves.push(square2);
            }
          }
        }
      }

      for (const dc of [-1, 1]) {
        const r = r0 + direction;
        const c = c0 + dc;

        if (!inBounds(r, c)) continue;

        const square = idx(r, c);

        if (isEnemy(board[square!]!)) {
          moves.push(square);
        }
      }

      break;
    }
  }

  return moves;
}