import { AppShell } from "./AppShell";
import type { ShellRouteProps } from "../types";

type PlaceholderPageProps = ShellRouteProps & {
  title: string;
  description: string;
};

export function PlaceholderPage({
  user,
  onLogout,
  title,
  description,
}: PlaceholderPageProps) {
  return (
    <AppShell user={user} onLogout={onLogout} pageTitle={title}>
      <section className="panel placeholder-panel">
        <p className="eyebrow">Framepost workspace</p>
        <h2>{title}</h2>
        <p className="status">{description}</p>
      </section>
    </AppShell>
  );
}
