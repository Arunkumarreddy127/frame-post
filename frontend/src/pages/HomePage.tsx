import { AppShell } from "../components/AppShell";
import { Homepage } from "../components/Homepage";
import type { ShellRouteProps } from "../types";

export function HomePage({ user, onLogout }: ShellRouteProps) {
  return (
    <AppShell user={user} onLogout={onLogout} pageTitle="Home">
      <Homepage user={user} />
    </AppShell>
  );
}
