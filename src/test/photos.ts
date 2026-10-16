/** Post photo input for tests: the given image ids, in order, without captions. */
export function photosOf(ids: string[]): { id: string; caption: string }[] {
  return ids.map((id) => ({ id, caption: "" }));
}
