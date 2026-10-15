import path from 'node:path';

// LaBSE: trained on translation pairs, so a title and its translation get close vectors
// ("The Godfather" / "Il Padrino" ≈ 0.81 cosine; unrelated titles stay below ~0.66).
const MODEL = 'Xenova/LaBSE';
export const DIMS = 768;

type Extractor = (texts: string[], options: object) => Promise<{ tolist(): number[][] }>;
let extractor: Promise<Extractor> | undefined;

/** Loads the model once (downloaded on first use to .cache/models, ~480 MB; ~10 s to load). */
function load(): Promise<Extractor> {
  extractor ??= (async () => {
    const { pipeline, env } = await import('@huggingface/transformers');
    env.cacheDir = path.resolve(__dirname, '..', '.cache', 'models');
    return (await pipeline('feature-extraction', MODEL, { dtype: 'q8' })) as unknown as Extractor;
  })();
  return extractor;
}

/** One normalized vector per text. */
export async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const model = await load();
  const output = await model(texts, { pooling: 'cls', normalize: true });
  return output.tolist();
}

export async function embedOne(text: string): Promise<number[]> {
  return (await embed([text]))[0];
}
