const buckets = new Map<string, { count: number; reset: number }>();
export function allowRequest(key: string, maximum: number, interval = 60000) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.reset < now) { if (buckets.size > 10000) buckets.clear(); buckets.set(key, { count: 1, reset: now + interval }); return true; }
  bucket.count++;
  return bucket.count <= maximum;
}
