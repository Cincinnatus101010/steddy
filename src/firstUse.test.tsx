import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { createRuntime, SteddyProvider } from "./context";
import { useSteddy } from "./useSteddy";

type User = { id: string; name: string };

function createDb() {
  const users = new Map<string, User>([
    ["ada", { id: "ada", name: "Ada" }],
    ["grace", { id: "grace", name: "Grace" }],
  ]);
  return {
    list: async () => [...users.values()],
    get: async (id: string) => {
      const user = users.get(id);
      if (!user) {
        throw new Error("missing");
      }
      return { ...user };
    },
    save: async (user: User) => {
      users.set(user.id, { ...user });
      return { ...user };
    },
  };
}

function FirstUseApp({ db }: { db: ReturnType<typeof createDb> }) {
  const [id, setId] = useState("ada");
  const list = useSteddy("users", db.list);
  const profile = useSteddy(
    ["user", id],
    async ([, userId]) => db.get(String(userId)),
    { keepPreviousData: true },
  );

  return (
    <div>
      <ul>
        {list.data?.map((user) => (
          <li key={user.id}>
            <button type="button" onClick={() => setId(user.id)}>
              {user.name}
            </button>
          </li>
        ))}
      </ul>
      <p data-testid="profile">{profile.data?.name ?? "loading"}</p>
      <button
        type="button"
        onClick={() => {
          const current = profile.data;
          if (!current) {
            return;
          }
          void (async () => {
            const next: User = {
              id: current.id,
              name: "Ada Lovelace",
            };
            await profile.mutate(next, { revalidate: false });
            await list.mutate(
              (current) =>
                current?.map((user) => (user.id === next.id ? next : user)) ?? [
                  next,
                ],
              { revalidate: false },
            );
          })();
        }}
      >
        Rename
      </button>
    </div>
  );
}

function wrapper(db: ReturnType<typeof createDb>) {
  const runtime = createRuntime();
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <SteddyProvider store={runtime.store} coordinator={runtime.coordinator}>
        {children}
      </SteddyProvider>
    );
  };
}

afterEach(() => {
  cleanup();
});

describe("first use", () => {
  it("loads a list and the selected profile under SteddyProvider", async () => {
    const db = createDb();
    render(<FirstUseApp db={db} />, { wrapper: wrapper(db) });

    await waitFor(() => {
      expect(screen.getByText("Ada")).toBeTruthy();
      expect(screen.getByText("Grace")).toBeTruthy();
    });
    expect(screen.getAllByText("Ada").length).toBeGreaterThan(1);
  });

  it("mutate updates the profile and the list without leaving the default cache", async () => {
    const db = createDb();
    render(<FirstUseApp db={db} />, { wrapper: wrapper(db) });

    await waitFor(() => {
      expect(screen.getByTestId("profile").textContent).toBe("Ada");
    });
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));

    await waitFor(() => {
      expect(screen.getByTestId("profile").textContent).toBe("Ada Lovelace");
      expect(screen.getByRole("button", { name: "Ada Lovelace" })).toBeTruthy();
    });
  });

  it("keepPreviousData holds the last profile while the new key loads", async () => {
    const db = createDb();
    let releaseGrace!: () => void;
    const blocked = new Promise<void>((resolve) => {
      releaseGrace = resolve;
    });
    const originalGet = db.get;
    db.get = async (id) => {
      if (id === "grace") {
        await blocked;
      }
      return originalGet(id);
    };

    render(<FirstUseApp db={db} />, { wrapper: wrapper(db) });
    await waitFor(() => {
      expect(screen.getByTestId("profile").textContent).toBe("Ada");
    });
    fireEvent.click(screen.getByRole("button", { name: "Grace" }));
    expect(screen.getByTestId("profile").textContent).toBe("Ada");
    releaseGrace();
    await waitFor(() => {
      expect(screen.getByTestId("profile").textContent).toBe("Grace");
    });
  });
});
