export type GameData = {
  fen: string;
  turn: 'w' | 'b';
  meta: Record<string, string | undefined>;
  seed: string;
  createdAt: number;
  closesAt: number;
};

export type StoredMove = {
  notation: string;
  pieceFrom: number;
  pieceTo: number;
  promotion?: 'knight' | 'bishop' | 'rook' | 'queen';
};

export type MoveInput = string | StoredMove;

export type SideSimulationStats = {
  players: number;
  illegalMoves: number;
  captures: number;
  totalScore: number;
};

export type SimulationStats = {
  white: SideSimulationStats;
  black: SideSimulationStats;
};

export type ScoreboardEntry = {
  username: string;
  score: number;
};

export type SideLeaderboards = {
  top: ScoreboardEntry[];
  bottom: ScoreboardEntry[];
};

export type Leaderboards = {
  white: SideLeaderboards;
  black: SideLeaderboards;
};

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
  simulationStats: SimulationStats;
  leaderboards: Leaderboards;
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
