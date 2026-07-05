export type GameData = {
  fen: string;
  turn: 'w' | 'b';
  meta: Record<string, string | undefined>;
  seed: string;
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
};



export type IncrementResponse = {
  type: 'increment';
  postId: string;
  count: number;
};

export type DecrementResponse = {
  type: 'decrement';
  postId: string;
  count: number;
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
  moves: string[];
};