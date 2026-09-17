export type SubscribedStore = {
  subscriberCount(key: string): number;
};

export function keysWithSubscribers(
  keys: string[],
  store: SubscribedStore,
): string[] {
  return keys.filter((key) => store.subscriberCount(key) > 0);
}
