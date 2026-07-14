import { Hono } from 'hono';
import type { OnAppInstallRequest, TriggerResponse } from '@devvit/web/shared';
import { context, scheduler } from '@devvit/web/server';
import { createPost } from '../core/post';
import { redis } from '@devvit/web/server';
import games from '../../../src/shared/pro_games_base_dataset.json';

export const triggers = new Hono();

const SCHEDULED_RELEASE_TASK = 'scheduledGameRelease';
const RELEASE_INTERVAL_MS = 24 * 60 * 60 * 1000;

type ScheduledReleaseTaskData = {
  subredditName?: string;
};

const scheduleKeyForSubreddit = (subredditName: string) =>
  `shadowchess_release_schedule_${subredditName.toLowerCase()}`;

const scheduleNextRelease = async (subredditName: string) => {
  const nextRunAt = new Date(Date.now() + RELEASE_INTERVAL_MS);
  const existingJobId = await redis.get(scheduleKeyForSubreddit(subredditName));

  if (existingJobId) {
    try {
      await scheduler.cancelJob(existingJobId);
    } catch (error) {
      console.warn(`Failed to cancel existing release job ${existingJobId}:`, error);
    }
  }

  const jobId = await scheduler.runJob({
    name: SCHEDULED_RELEASE_TASK,
    data: { subredditName },
    runAt: nextRunAt,
  });

  await redis.set(scheduleKeyForSubreddit(subredditName), jobId);
};

triggers.post('/on-app-install', async (c) => {
  try {
    const post = await createPost();
    const input = await c.req.json<OnAppInstallRequest>();
    const subredditName = context.subredditName;

    if (!subredditName) {
      throw new Error('Missing subreddit context for app install');
    }
    
    await redis.set('shadowchess_games', JSON.stringify(games));
    await scheduleNextRelease(subredditName);

    return c.json<TriggerResponse>(
      {
        status: 'success',
        message: `Post created in subreddit ${context.subredditName} with id ${post.id} (trigger: ${input.type})`,
      },
      200
    );
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    return c.json<TriggerResponse>(
      {
        status: 'error',
        message: 'Failed to create post',
      },
      400
    );
  }
});

triggers.post('/scheduled-release', async (c) => {
  try {
    const input = await c.req.json<{ data?: ScheduledReleaseTaskData }>();
    const subredditName = input?.data?.subredditName ?? context.subredditName;

    if (!subredditName) {
      throw new Error('Missing subreddit context for scheduled release');
    }

    await createPost(subredditName);
    await scheduleNextRelease(subredditName);

    return c.json<TriggerResponse>(
      {
        status: 'success',
        message: `Scheduled release created in subreddit ${subredditName}`,
      },
      200
    );
  } catch (error) {
    console.error(`Error in scheduled release: ${error}`);
    return c.json<TriggerResponse>(
      {
        status: 'error',
        message: 'Failed scheduled release',
      },
      400
    );
  }
});
