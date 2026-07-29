import { createHash } from 'crypto';

const NAMESPACE_TREASURE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

export function generateUid(name: string, author: string): string {
  const input = `${name}@${author}`;
  const hash = createHash('sha1')
    .update(Buffer.from(NAMESPACE_TREASURE.replace(/-/g, ''), 'hex'))
    .update(Buffer.from(input, 'utf-8'))
    .digest();

  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;

  const hex = hash.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-|-$/g, '')
    .replace(/[\u4e00-\u9fa5]/g, '');
}
