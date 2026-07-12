import { createHash } from 'node:crypto';
import type { GameData } from '../../shared/api';
import { redis } from '@devvit/web/server';




type FenEntry = {
  fen: string;
  meta: Record<string, string | undefined>;
};
// const fenPath = path.resolve(process.cwd(), 'public', 'Games', 'anand_games.json');

const loadFenList = async (): Promise<FenEntry[]> => {
//   const raw = await readFile(fenPath, 'utf8');
//   const data = JSON.parse(raw);
const games = JSON.parse(await redis.get('shadowchess_games') ?? '[]');

  return (games as any[])
    .map((entry) => {
      const fen = typeof entry === 'string' ? entry : entry.fen ?? entry.final_fen ?? '';
      if (!fen) return null;

      const meta =
        typeof entry === 'string'
          ? {}
          : {
              white: entry.white,
              black: entry.black,
              year: entry.year,
              event: entry.event,
              date: entry.date,
              site: entry.site,
              round: entry.round,
              white_elo: entry.white_elo,
              black_elo: entry.black_elo,
              eco: entry.eco,
              result: entry.result,
            };

      return { fen, meta };
    })
    .filter(Boolean) as FenEntry[];
};

const parseFEN = (fen: string): 'w' | 'b' => {
  const parts = fen.trim().split(/\s+/);
  if (parts.length < 2) return 'w';
  return parts[1] === 'b' ? 'b' : 'w';
};

const hashSeedToIndex = (seed: string, length: number) => {
  const hash = createHash('sha256').update(seed).digest();
  let acc = 0;
  for (let i = 0; i < 4; i += 1) {
    acc = (acc << 8) | hash[i]!;
  }
  return Math.abs(acc) % length;
};

export const createGameData = async (seed: string): Promise<GameData> => {
  const fenList = await loadFenList();
  if (fenList.length === 0) {
    throw new Error('No FEN entries available for game generation');
  }

  const index = hashSeedToIndex(seed, fenList.length);
  const chosen = fenList[index];
  const createdAt = Date.now();
  const closesAt = createdAt + 24 * 60 * 60 * 1000;

  return {
    fen: chosen!.fen,
    turn: parseFEN(chosen!.fen),
    meta: chosen!.meta,
    seed,
    createdAt,
    closesAt,
  };
};
