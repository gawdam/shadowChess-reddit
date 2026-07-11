import { Hono } from 'hono';
import { context, redis, reddit } from '@devvit/web/server';
import games from '../../../src/shared/anand_games.json';
import type {
  GameData,
  InitResponse,
  MoveInput,
  SetSideResponse,
  SubmitMovesResponse,
} from '../../shared/api';
import { calculateMidgameZeroSumScore } from '../core/chessScoring';

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
    const hasSubmitted = (await redis.get(`game_${postId}_${username}_has_submitted`)) === 'true';
    const score = await redis.get(`game_${postId}_${username}_score`);
    const movesData = await redis.get(`game_${postId}_${username}_moves`);
    const playerCounts = {
      white: parseInt((await redis.get(`playerCount_${postId}_white`)) || '0'),
      black: parseInt((await redis.get(`playerCount_${postId}_black`)) || '0'),
    };
    const bestMatchData = await redis.get(`game_${postId}_${username}_best_match`);
    const worstMatchData = await redis.get(`game_${postId}_${username}_worst_match`);
    await redis.set(`game_${postId}_fen`, gameData?.fen!); // Ensure the side is stored even if null

    return c.json<InitResponse>({
      type: 'init',
      postId: postId,
      count: count ? parseInt(count) : 0,
      username,
      gameData,
      userSide: (savedSide as 'white' | 'black') || null,
      playerCounts: playerCounts,
      score: score ? Number(score) : null,      hasSubmitted: hasSubmitted,
      moves: movesData ? JSON.parse(movesData) : [],
      bestMatch: bestMatchData ? JSON.parse(bestMatchData) : null, // Placeholder for best match data
      worstMatch: worstMatchData ? JSON.parse(worstMatchData) : null, // Placeholder for worst match data
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
    // 3. Add user to their newly selected team roster
    const currentRosterKey = `game_${postId}_${body.side}_players`;
    const currentRosterData = await redis.get(currentRosterKey);
    const currentRoster: string[] = currentRosterData ? JSON.parse(currentRosterData) : [];

    if (!currentRoster.includes(username)) {
      currentRoster.push(username);
      await redis.set(currentRosterKey, JSON.stringify(currentRoster));
    }
  
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
    const body = await c.req.json<{ moves: MoveInput[] }>();
    
    // Validate that moves array exists and has exactly 5 moves
    if (!body.moves || !Array.isArray(body.moves) || body.moves.length !== 5) {
      return c.json<ErrorResponse>({ 
        status: 'error', 
        message: 'Invalid moves payload. Exactly 5 moves are required.' 
      }, 400);
    }

    const invalidMove = body.moves.some((move) => {
      if (typeof move === 'string') return move.trim().length === 0;

      return (
        typeof move.notation !== 'string' ||
        typeof move.pieceFrom !== 'number' ||
        typeof move.pieceTo !== 'number' ||
        move.pieceFrom < 0 ||
        move.pieceFrom > 63 ||
        move.pieceTo < 0 ||
        move.pieceTo > 63 ||
        move.pieceFrom === move.pieceTo
      );
    });

    if (invalidMove) {
      return c.json<ErrorResponse>({
        status: 'error',
        message: 'Invalid moves payload. Moves must include notation, pieceFrom, and pieceTo.',
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

api.post('/update-scores', async (c) => {
  const { postId } = context; // Extracted from Devvit context
  if (!postId) {
    return c.json({ status: 'error', message: 'postId is required' }, 400);
  }

  try {
    const username = (await reddit.getCurrentUsername()) ?? 'anonymous';

    // 1. Get the user's side and moves from Redis
    const sideKey = `game_${postId}_${username}_side`;
    const userSide = (await redis.get(sideKey)) as 'white' | 'black' | null;

    if (!userSide) {
      return c.json({ status: 'error', message: 'User team side selection not found.' }, 400);
    }

    const movesKey = `game_${postId}_${username}_moves`;
    const userMovesData = await redis.get(movesKey);
    if (!userMovesData) {
      return c.json({ status: 'error', message: 'No moves found for this user. Please submit moves first.' }, 400);
    }
    const userMoves: MoveInput[] = JSON.parse(userMovesData);

    // Fetch the base midgame FEN puzzle state safely stored on the server
    const fenKey = `game_${postId}_fen`;
    const initialFen = (await redis.get(fenKey)) ?? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'; // Standard fallback if empty

    // 2. Get the opponents' usernames from Redis
    const opposingSide = userSide === 'white' ? 'black' : 'white';
    const opponentsRosterKey = `game_${postId}_${opposingSide}_players`;
    const opponentsData = await redis.get(opponentsRosterKey);
    const opponents: string[] = opponentsData ? JSON.parse(opponentsData) : [];

    let accumulatedUserScoreDelta = 0;
    let matchesEvaluatedCount = 0;
    let bestScore = -Infinity;
    let worstScore = Infinity;

    // 3. For each opponent username, run cross-evaluation matrices
    for (const opponent of opponents) {
      // Enforce clean match history pairing protection to keep execution idempotent
      const matchHistoryKey = userSide === 'white'
        ? `game_${postId}_match_${username}_vs_${opponent}`
        : `game_${postId}_match_${opponent}_vs_${username}`;

      const alreadyComputed = await redis.get(matchHistoryKey);
      if (alreadyComputed) continue; // Match was already processed, skip it

      // a. Get opponent moves
      const opponentMovesKey = `game_${postId}_${opponent}_moves`;
      const opponentMovesData = await redis.get(opponentMovesKey);
      if (!opponentMovesData) continue; // Opponent registered on roster but hasn't played yet
      const opponentMoves: MoveInput[] = JSON.parse(opponentMovesData);

      // Determine absolute perspective parameters for the simulation engine
      const whiteMoves = userSide === 'white' ? userMoves : opponentMoves;
      const blackMoves = userSide === 'white' ? opponentMoves : userMoves;

      // b. Pass the moves to calculateMidgameZeroSumScore
      const scoresResult = calculateMidgameZeroSumScore(initialFen, whiteMoves, blackMoves);

      // Extract context points based on side assignment
      const userEarnedDelta = userSide === 'white' ? scoresResult.white : scoresResult.black;
      const opponentEarnedDelta = userSide === 'white' ? scoresResult.black : scoresResult.white;

      // c. Increment/decrement the score for opponent, keep adding to user total
      if (userEarnedDelta > bestScore) {
        bestScore = userEarnedDelta;
        await redis.set(`game_${postId}_${username}_best_match`, JSON.stringify({
          opponent: opponent,
          userMoves: userMoves,
          opponentMoves: opponentMoves,
          score: userEarnedDelta
        }));
      }
      if (userEarnedDelta < worstScore) {
        worstScore = userEarnedDelta;
        await redis.set(`game_${postId}_${username}_worst_match`, JSON.stringify({
          opponent: opponent,
          userMoves: userMoves,
          opponentMoves: opponentMoves,
          score: userEarnedDelta
        }));
      }

      const opponentBestScore = await redis.get(`game_${postId}_${opponent}_best_match`);
      const opponentWorstScore = await redis.get(`game_${postId}_${opponent}_worst_match`);

      if (!opponentBestScore || opponentEarnedDelta > JSON.parse(opponentBestScore).score) {
        await redis.set(`game_${postId}_${opponent}_best_match`, JSON.stringify({
          opponent: username,
          userMoves: opponentMoves,
          opponentMoves: userMoves,
          score: opponentEarnedDelta
        }));
      }
      if (!opponentWorstScore || opponentEarnedDelta < JSON.parse(opponentWorstScore).score) {
        await redis.set(`game_${postId}_${opponent}_worst_match`, JSON.stringify({
          opponent: username,
          userMoves: opponentMoves,
          opponentMoves: userMoves,
          score: opponentEarnedDelta
        }));
      }

      accumulatedUserScoreDelta += userEarnedDelta;

      const opponentScoreKey = `game_${postId}_${opponent}_score`;
      const currentOpponentScore = Number(await redis.get(opponentScoreKey) ?? 0);
      await redis.set(opponentScoreKey, String(currentOpponentScore + opponentEarnedDelta));

      // Lock this specific game pair in Redis
      await redis.set(matchHistoryKey, 'true');
      matchesEvaluatedCount++;
    }

    // 4. Update and save the current user's aggregated score
    const userScoreKey = `game_${postId}_${username}_score`;
    const existingUserScore = Number(await redis.get(userScoreKey) ?? 0);
    const finalUserScore = existingUserScore + accumulatedUserScoreDelta;
    await redis.set(userScoreKey, String(finalUserScore));

    // Flag the user as scored/fully processed
    await redis.set(`game_${postId}_${username}_has_submitted`, 'true');

    return c.json({
      status: 'success',
      username,
      userSide,
      updatedScore: finalUserScore,
      matchesEvaluated: matchesEvaluatedCount
    });

  } catch (error) {
    console.error('Error executing score evaluations:', error);
    return c.json({ status: 'error', message: 'Failed to process match matrix evaluation calculation' }, 500);
  }
});
