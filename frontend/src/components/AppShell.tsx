import { useEffect, useState } from "react";
import { MessageSquare } from "lucide-react";
import { ChatPanel } from "./ChatPanel";
import { Header } from "./Header";
import { PageSidebar } from "./PageSidebar";
import { Sidebar } from "./Sidebar";
import type { User } from "../types";

const CHAT_OPEN_KEY = "framepost.chatPanelOpen";

type AppShellProps = {
  children: React.ReactNode;
  user: User;
  onLogout: () => Promise<void>;
  pageTitle: string;
  backTo?: string;
  sidebar?: "global" | "page";
  pageId?: string;
  filesExplorer?: React.ReactNode;
  chatPanel?: boolean;
};

export function AppShell({
  children,
  user,
  onLogout,
  pageTitle,
  backTo = "/home",
  sidebar = "global",
  pageId,
  filesExplorer,
  chatPanel = true,
}: AppShellProps) {
  const [chatOpen, setChatOpen] = useState(
    () => window.localStorage.getItem(CHAT_OPEN_KEY) !== "false",
  );

  useEffect(() => {
    window.localStorage.setItem(CHAT_OPEN_KEY, String(chatOpen));
  }, [chatOpen]);

  const showChat = chatPanel && chatOpen;

  return (
    <div className="shell app-shell">
      <Header
        username={user.username}
        pageTitle={pageTitle}
        onLogout={onLogout}
        actions={
          chatPanel ? (
            <button
              type="button"
              className={`chat-toggle${chatOpen ? " active" : ""}`}
              aria-pressed={chatOpen}
              aria-label={chatOpen ? "Hide chat" : "Show chat"}
              title={chatOpen ? "Hide chat" : "Show chat"}
              onClick={() => setChatOpen((current) => !current)}
            >
              <MessageSquare size={17} strokeWidth={2} aria-hidden="true" />
              <span>Chat</span>
            </button>
          ) : undefined
        }
      />
      <div
        className={`app-body${showChat ? " has-chat" : ""}`}
      >
        {sidebar === "page" ? (
          <PageSidebar pageId={pageId} filesExplorer={filesExplorer} />
        ) : (
          <Sidebar backTo={backTo} filesExplorer={filesExplorer} />
        )}
        <main className="app-main">{children}</main>
        {chatPanel && (
          <aside className="app-chat" hidden={!chatOpen}>
            <ChatPanel pageId={pageId} />
          </aside>
        )}
      </div>
    </div>
  );
}
