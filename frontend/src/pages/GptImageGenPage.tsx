import { AppShell } from "../components/AppShell";
import type { ShellRouteProps } from "../types";

export function GptImageGenPage({ user, onLogout }: ShellRouteProps) {
  return (
    <AppShell user={user} onLogout={onLogout} pageTitle="Image" backTo="/create">
      <section className="panel placeholder-panel">
        <p className="eyebrow">Framepost workspace</p>
        <h2>Image</h2>
        <p className="status">Generate images with GPT image models.</p>
      </section>
    </AppShell>
  );
}
