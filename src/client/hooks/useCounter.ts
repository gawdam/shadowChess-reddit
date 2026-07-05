import { useCallback, useEffect, useState } from 'react';
import type {
  InitResponse,
  IncrementResponse,
  DecrementResponse,
} from '../../shared/api';

interface CounterState {
  count: number;
  username: string | null;
  gameData: InitResponse['gameData'];
  loading: boolean;
  userSide: 'white' | 'black' | null;
  playerCounts: { white: number; black: number } | null;
}

export const useCounter = () => {
  const [state, setState] = useState<CounterState>({
    count: 0,
    username: null,
    gameData: null,
    loading: true,
    userSide: null,
    playerCounts: null,
  });
  const [postId, setPostId] = useState<string | null>(null);
  // Add a dedicated state variable for move submission tracking
  const [submitting, setSubmitting] = useState<boolean>(false);

  // fetch initial data
  useEffect(() => {
    const init = async () => {
      try {
        const res = await fetch('/api/init');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: InitResponse = await res.json();
        if (data.type !== 'init') throw new Error('Unexpected response');
        console.log('Init response:', data.userSide);
        setState({
          count: data.count,
          username: data.username,
          gameData: data.gameData ?? null,
          loading: false,
          userSide: data.userSide ?? null,
          playerCounts: data.playerCounts ?? null,
        });
        setPostId(data.postId);
      } catch (err) {
        console.error('Failed to init counter', err);
        setState((prev) => ({ ...prev, loading: false }));
      }
    };
    void init();
  }, []);

  const selectSide = useCallback(async (side: 'white' | 'black') => {
    setState((prev) => ({ ...prev, userSide: side }));
    try {
      const res = await fetch('/api/set-side', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ side }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      console.error('Failed to save chosen side', err);
      setState((prev) => ({ ...prev, userSide: null }));
    }
  }, []);

  const update = useCallback(
    async (action: 'increment' | 'decrement') => {
      if (!postId) {
        console.error('No postId – cannot update counter');
        return;
      }
      try {
        const res = await fetch(`/api/${action}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: IncrementResponse | DecrementResponse = await res.json();
        setState((prev) => ({ ...prev, count: data.count }));
      } catch (err) {
        console.error(`Failed to ${action}`, err);
      }
    },
    [postId]
  );

  // NEW: Add the submitMoves handler callback
  const submitMoves = useCallback(async (moveNotations: string[]) => {
    if (!postId) {
      console.error('No postId – cannot submit moves');
      alert('Post ID missing. Please refresh and try again.');
      return false;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/submit-moves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moves: moveNotations }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || `HTTP error! status: ${res.status}`);
      }

      alert('Moves submitted successfully!');
      return true; // Return status back to the caller
    } catch (err) {
      console.error('Failed to submit moves:', err);
      alert(err instanceof Error ? err.message : 'Failed to save moves.');
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [postId]);

  const increment = useCallback(() => update('increment'), [update]);
  const decrement = useCallback(() => update('decrement'), [update]);

  return {
    ...state,
    increment,
    decrement,
    selectSide,
    submitMoves,     // Exposing the submission callback
    submitting,      // Exposing the submission flag
    userSide: state.userSide,
    playerCounts: state.playerCounts,
  } as const;
};