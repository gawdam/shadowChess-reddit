import { useCallback, useEffect, useState } from 'react';
import type {
  InitResponse,
  Leaderboards,
  MatchRecord,
  MoveInput,
  SimulationStats,
  StoredMove,
} from '../../shared/api';

// Consolidated user profile block
type UserData = {
  username: string;
  userSide: 'white' | 'black' | null;
  hasSubmitted: boolean;
  moves: MoveInput[];
  score: number | null;
  bestMatch: MatchRecord | null;   // New field
  worstMatch: MatchRecord | null;  // New field
};

type CounterState = {
  count: number;
  gameData: InitResponse['gameData'];
  loading: boolean;
  playerCounts: { white: number; black: number } | null;
  simulationStats: SimulationStats;
  leaderboards: Leaderboards;
  userData: UserData; // Unified data block
};

const defaultSimulationStats: SimulationStats = {
  white: {
    players: 0,
    illegalMoves: 0,
    captures: 0,
    totalScore: 0,
  },
  black: {
    players: 0,
    illegalMoves: 0,
    captures: 0,
    totalScore: 0,
  },
};

const defaultLeaderboards: Leaderboards = {
  white: { top: [], bottom: [] },
  black: { top: [], bottom: [] },
};

export const useCounter = () => {
  const [state, setState] = useState<CounterState>({
    count: 0,
    gameData: null,
    loading: true,
    playerCounts: null,
    simulationStats: defaultSimulationStats,
    leaderboards: defaultLeaderboards,
    userData: {
      username: 'anonymous',
      userSide: null,
      hasSubmitted: false,
      moves: [],
      score: null,
      bestMatch: null,
      worstMatch: null,
    },
  });
  const [postId, setPostId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [selectingSide, setSelectingSide] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const refreshData = useCallback(async (mode: 'initial' | 'background' = 'background') => {
    if (mode === 'initial') {
      setState((prev) => ({ ...prev, loading: true }));
    } else {
      setRefreshing(true);
    }

    try {
      const res = await fetch('/api/init');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: InitResponse = await res.json();
      if (data.type !== 'init') throw new Error('Unexpected response');

      setState((prev) => ({
        ...prev,
        count: data.count,
        gameData: data.gameData ?? null,
        loading: false,
        playerCounts: data.playerCounts ?? null,
        simulationStats: data.simulationStats ?? defaultSimulationStats,
        leaderboards: data.leaderboards ?? defaultLeaderboards,
        userData: {
          username: data.username ?? 'anonymous',
          userSide: data.userSide ?? null,
          hasSubmitted: data.hasSubmitted ?? false,
          moves: data.moves ?? [],
          score: data.score ?? null,
          bestMatch: data.bestMatch ?? null,
          worstMatch: data.worstMatch ?? null,
        },
      }));
      setPostId(data.postId);
      return data;
    } catch (err) {
      console.error('Failed to init counter', err);
      setState((prev) => ({ ...prev, loading: false }));
      return null;
    } finally {
      if (mode === 'background') {
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void refreshData('initial');
  }, [refreshData]);

  // Update chosen side safely within unified structure
  const selectSide = useCallback(async (side: 'white' | 'black') => {
    setSelectingSide(true);
    setState((prev) => ({
      ...prev,
      userData: { ...prev.userData, userSide: side }
    }));
    
    try {
      const res = await fetch('/api/set-side', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ side }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      console.error('Failed to save chosen side', err);
      setState((prev) => ({
        ...prev,
        userData: { ...prev.userData, userSide: null }
      }));
    } finally {
      setSelectingSide(false);
    }
  }, []);

  // Updated Move Submission & Server Scoring Pipeline Handler
  const submitMoves = useCallback(async (moveRecords: StoredMove[]) => {
    if (!postId) {
      console.error('No postId – cannot submit moves');
      return false;
    }

    setSubmitting(true);
    try {
      // Step 1: Save the raw move arrays to the backend database
      const movesRes = await fetch('/api/submit-moves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moves: moveRecords }),
      });

      const movesData = await movesRes.json();
      if (!movesRes.ok) throw new Error(movesData.message || `HTTP ${movesRes.status}`);

      // Step 2: Trigger the matrix scoring engine on the server
      const scoreRes = await fetch('/api/update-scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}), // Payload determined implicitly via server context / session keys
      });

      const scoreData = await scoreRes.json();
      if (!scoreRes.ok) throw new Error(scoreData.message || `HTTP ${scoreRes.status}`);

      setState((prev) => ({
        ...prev,
        simulationStats: scoreData.simulationStats ?? prev.simulationStats,
      }));

      await refreshData('background');

      return true;
    } catch (err) {
      console.error('Failed to submit moves and update scores:', err);
      alert(err instanceof Error ? err.message : 'Failed to save moves.');
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [postId]);

  const postReplayComment = useCallback(async (input: {
    opponent: string;
    userComment: string;
    tagOpponent: boolean;
    matchType: 'best' | 'worst';
    moves: MoveInput[];
    score: number;
  }) => {
    const response = await fetch('/api/post-replay-comment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error((data as { message?: string }).message ?? 'Failed to post replay comment');
    }

    return data as { status: 'success'; commentId: string };
  }, []);

  return {
    ...state,
    userData: state.userData, 
    submitting,
    submitMoves,
    selectSide,
    refreshData,
    postReplayComment,
    selectingSide,
    refreshing,
  } as const;
};
