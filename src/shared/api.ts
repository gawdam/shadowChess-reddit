export type GameData = {
  fen: string;
  turn: 'w' | 'b';
  meta: Record<string, string | undefined>;
  seed: string;
};

export type StoredMove = {
  notation: string;
  pieceFrom: number;
  pieceTo: number;
};

export type MoveInput = string | StoredMove;

export type InitResponse = {
  type: 'init';
  postId: string;
  count: number;
  username: string;
  gameData: GameData | null;
  userSide: 'white' | 'black' | null;
  playerCounts: {
    white: number;
    black: number;
  };
  score: number | null;
  hasSubmitted: boolean;
  moves: MoveInput[];
  bestMatch: MatchRecord | null;
  worstMatch: MatchRecord | null;
};

export type MatchRecord = {
  opponent: string;
  userMoves: MoveInput[];
  opponentMoves: MoveInput[];
  score: number;
};

export type SetSideResponse = {
  status: 'success';
  postId: string;
  username: string;
  side: 'white' | 'black';
};

export type SubmitMovesResponse = {
  status: 'success';
  postId: string;
  username: string;
  moves: MoveInput[];
};
