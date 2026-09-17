import { createCoordinator } from "./coordinator";
import { createStore } from "./store";

export const defaultStore = createStore();
export const defaultCoordinator = createCoordinator(defaultStore);
