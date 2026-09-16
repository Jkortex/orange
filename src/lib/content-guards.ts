import type { CollectionEntry, CollectionType } from './content'

/**
 * 类型守卫：泛型 union 无法按 collection 字面量自动窄化，显式收窄到音乐条目
 */
export function isMusic(
  entry: CollectionEntry<CollectionType>,
): entry is CollectionEntry<'music'> {
  return entry.collection === 'music'
}

export function isLife(
  entry: CollectionEntry<CollectionType>,
): entry is CollectionEntry<'life'> {
  return entry.collection === 'life'
}

