import { bench, describe } from "vitest";
import { createCoordinator } from "../src/coordinator";
import { createStore } from "../src/store";

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(resolve, ms);
    if (!signal) {
      return;
    }
    const onAbort = () => {
      clearTimeout(id);
      reject(new DOMException("Aborted", "AbortError"));
    };
    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

describe("coordinator", () => {
  bench("write 200 unique keys", async () => {
    const store = createStore();
    const coordinator = createCoordinator(store);
    for (let i = 0; i < 200; i++) {
      await coordinator.revalidate(`k${i}`, async () => i);
    }
  });

  bench("abort a slow in-flight request", async () => {
    const store = createStore();
    const coordinator = createCoordinator(store);
    const slow = coordinator.revalidate("user", async (_key, { signal }) => {
      await delay(8, signal);
      return "slow";
    });
    await delay(1);
    await coordinator.revalidate("user", async () => "fast");
    await slow.catch(() => undefined);
  });

  bench("dedup a second revalidate", async () => {
    const store = createStore();
    const coordinator = createCoordinator(store);
    await coordinator.revalidate("user", async () => "ok");
    await coordinator.revalidate("user", async () => "again");
  });

  bench("naive wait for both overlapping fetches", async () => {
    const slow = delay(8).then(() => "slow");
    await delay(1);
    const fast = delay(2).then(() => "fast");
    await Promise.all([slow, fast]);
  });
});
