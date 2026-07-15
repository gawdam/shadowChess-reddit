import { Hono } from 'hono';
import type { TriggerResponse } from '@devvit/web/shared';
import { context, redis } from '@devvit/web/server';
import { createPost } from '../core/post';
import games from '../../../src/shared/pro_games_base_dataset.json';

export const scheduler = new Hono();

scheduler.post('/daily-post', async (c) => {
  try {
    const subredditName = context.subredditName;

    if (!subredditName) {
      throw new Error('Missing subreddit context for scheduled post');
    }

    await redis.set('shadowchess_games', JSON.stringify(games));
    const post = await createPost(subredditName);

    return c.json<TriggerResponse>(
      {
        status: 'success',
        message: `Scheduled post created in subreddit ${subredditName} with id ${post.id}`,
      },
      200
    );
  } catch (error) {
    console.error('Error creating scheduled post:', error);
    return c.json<TriggerResponse>(
      {
        status: 'error',
        message: 'Failed to create scheduled post',
      },
      400
    );
  }
});
