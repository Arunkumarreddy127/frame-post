import { createContext } from "react";
import type { Page } from "../types";

export const PageWorkspaceUpdateContext = createContext<
  ((page: Page) => void) | null
>(null);
