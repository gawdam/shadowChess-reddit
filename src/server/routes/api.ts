import { Hono } from 'hono';
import { context, redis, reddit } from '@devvit/web/server';
import games from '../../../src/shared/anand_games.json';
import type {
  DecrementResponse,
  GameData,
  InitResponse,
  IncrementResponse,
  SetSideResponse,
  SubmitMovesResponse,
} from '../../shared/api';

type ErrorResponse = {
  status: 'error';
  message: string;
};


export const api = new Hono();

api.get('/init', async (c) => {
  const { postId } = context;
  await redis.set('shadowchess_anand_games', JSON.stringify(games));

  if (!postId) {
    console.error('API Init Error: postId not found in devvit context');
    return c.json<ErrorResponse>(
      {
        status: 'error',
        message: 'postId is required but missing from context',
      },
      400
    );
  }

  try {
    const [count, usernameRaw, gameDataJson] = await Promise.all([
      redis.get('count'),
      reddit.getCurrentUsername(),
      redis.get(`game_${postId}`),
    ]);

    const username = usernameRaw ?? 'anonymous';
    const savedSide = await redis.get(`game_${postId}_${username}_side`);
    const gameData = gameDataJson ? (JSON.parse(gameDataJson) as GameData) : null;
    const playerCounts = {
      white: parseInt((await redis.get(`playerCount_${postId}_white`)) || '0'),
      black: parseInt((await redis.get(`playerCount_${postId}_black`)) || '0'),
    };

    return c.json<InitResponse>({
      type: 'init',
      postId: postId,
      count: count ? parseInt(count) : 0,
      username,
      gameData,
      userSide: (savedSide as 'white' | 'black') || null,
      playerCounts: playerCounts,
    });
  } catch (error) {
    console.error(`API Init Error for post ${postId}:`, error);
    let errorMessage = 'Unknown error during initialization';
    if (error instanceof Error) {
      errorMessage = `Initialization failed: ${error.message}`;
    }
    return c.json<ErrorResponse>(
      { status: 'error', message: errorMessage },
      400
    );
  }
});

api.post('/increment', async (c) => {
  const { postId } = context;
  if (!postId) {
    return c.json<ErrorResponse>(
      {
        status: 'error',
        message: 'postId is required',
      },
      400
    );
  }

  const count = await redis.incrBy('count', 1);
  return c.json<IncrementResponse>({
    count,
    postId,
    type: 'increment',
  });
});

api.post('/decrement', async (c) => {
  const { postId } = context;
  if (!postId) {
    return c.json<ErrorResponse>(
      {
        status: 'error',
        message: 'postId is required',
      },
      400
    );
  }

  const count = await redis.incrBy('count', -1);
  return c.json<DecrementResponse>({
    count,
    postId,
    type: 'decrement',
  });
});

// ... your existing imports and api definition

api.post('/set-side', async (c) => {
  const { postId } = context;
  if (!postId) {
    return c.json<ErrorResponse>({ status: 'error', message: 'postId is required' }, 400);
  }

  try {
    const body = await c.req.json<{ side: 'white' | 'black' }>();
    if (!body.side || (body.side !== 'white' && body.side !== 'black')) {
      return c.json<ErrorResponse>({ status: 'error', message: 'Invalid side. Must be "white" or "black"' }, 400);
    }

    const username = (await reddit.getCurrentUsername()) ?? 'anonymous';
    
    // Store the chosen side using a composite key: game_{postId}_{username}_side
    const redisKey = `game_${postId}_${username}_side`;
    await redis.set(redisKey, body.side);
    console.log(`Set side for user ${username} in post ${postId} to ${body.side}`);
    await redis.incrBy(`playerCount_${postId}_${body.side}`, 1); // Increment the player count for the chosen side

    return c.json<SetSideResponse>({
      
      status: 'success',
      postId,
      username,
      side: body.side,
      
    });
  } catch (error) {
    console.error('Error setting side:', error);
    return c.json<ErrorResponse>({ status: 'error', message: 'Failed to save chosen side' }, 500);
  }
});

api.post('/submit-moves', async (c) => {
  const { postId } = context;
  if (!postId) {
    return c.json<ErrorResponse>({ status: 'error', message: 'postId is required' }, 400);
  }

  try {
    const body = await c.req.json<{ moves: string[] }>();
    
    // Validate that moves array exists and has exactly 5 moves
    if (!body.moves || !Array.isArray(body.moves) || body.moves.length !== 5) {
      return c.json<ErrorResponse>({ 
        status: 'error', 
        message: 'Invalid moves payload. Exactly 5 moves are required.' 
      }, 400);
    }

    const username = (await reddit.getCurrentUsername()) ?? 'anonymous';
    
    // Store the moves sequence using a composite key: game_{postId}_{username}_moves
    const redisKey = `game_${postId}_${username}_moves`;
    await redis.set(redisKey, JSON.stringify(body.moves));

    return c.json<SubmitMovesResponse>({
      status: 'success',
      postId,
      username,
      moves: body.moves,
    });
  } catch (error) {
    console.error('Error submitting moves:', error);
    return c.json<ErrorResponse>({ status: 'error', message: 'Failed to save moves' }, 500);
  }
});