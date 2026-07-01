import { context, reddit, redis } from '@devvit/web/server';
import { createGameData } from './gameGenerator';

export const createPost = async () => {
  const subredditName = context.subredditName;
  if (!subredditName) {
    console.log('Missing subreddit context for post creation');
    throw new Error('Missing subreddit context for post creation');
  }

  const post = await reddit.submitCustomPost({
    subredditName,
    title: 'asyncchess',
  });

  const gameData = await createGameData(post.id);
  console.log(`Generated game data for post ${post.id}:`, gameData);
  await redis.set(`game_${post.id}`, JSON.stringify(gameData));

  const currentUser = await reddit.getCurrentUser();
  if (currentUser?.id) {
    await redis.set(`game_${post.id}_${currentUser.id}`, JSON.stringify(gameData));
  }

  console.log(`Created post with id ${post.id} in subreddit ${subredditName}`);
  return post;
};
