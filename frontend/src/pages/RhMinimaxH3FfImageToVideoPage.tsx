import { AppShell } from "../components/AppShell";
import type { ShellRouteProps } from "../types";

export function RhMinimaxH3FfImageToVideoPage({ user, onLogout }: ShellRouteProps) {
  return (
    <AppShell
      user={user}
      onLogout={onLogout}
      pageTitle="Minimax H3 - FF Image to Video"
      backTo="/create"
    >
      <section className="panel placeholder-panel">
        <p className="eyebrow">Framepost workspace</p>
        <h2>Minimax H3 - FF Image to Video</h2>
        <p className="status">Turn a still image into a video with Minimax H3 (FF).</p>
      </section>
    </AppShell>
  );
}
