import { context, reddit, redis } from '@devvit/web/server';
import { createGameData } from './gameGenerator';

const firstNamePart = (value: string | undefined, fallback: string) => {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return fallback;
  const [firstPart] = trimmed.split(',');
  return (firstPart ?? '').trim() || fallback;
};

export const createPost = async () => {
  const subredditName = context.subredditName;
  if (!subredditName) {
    console.log('Missing subreddit context for post creation');
    throw new Error('Missing subreddit context for post creation');
  }

  const seed = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const gameData = await createGameData(seed);
  const whiteName = firstNamePart(gameData.meta?.white, 'White');
  const blackName = firstNamePart(gameData.meta?.black, 'Black');
  const eventName = (gameData.meta?.event ?? '').trim() || 'Unknown Event';
  const postTitle = `${whiteName} vs ${blackName}: ${eventName}`;

  const post = await reddit.submitCustomPost({
    subredditName,
    title: postTitle,
  });

  gameData.seed = post.id;
  console.log(`Generated game data for post ${post.id}:`, gameData);
  await redis.set(`game_${post.id}`, JSON.stringify(gameData));

  const currentUser = await reddit.getCurrentUser();
  if (currentUser?.id) {
    await redis.set(`game_${post.id}_${currentUser.id}`, JSON.stringify(gameData));
  }

  console.log(`Created post with id ${post.id} in subreddit ${subredditName}`);
  return post;
};
