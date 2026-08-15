import { getTreasure } from './bridge';

/** Plugin-private storage uses relative keys only; absolute paths are never exposed. */
export const storage = {
  read: (key: string) => getTreasure().storage.read(key),
  write: (input: { key: string; data: Uint8Array }) => getTreasure().storage.write(input),
  remove: (key: string) => getTreasure().storage.remove(key),
};
