import { useParams } from "react-router-dom";
import { ChatPage } from "./ChatPage";
import { PlaceholderPage } from "../components/PlaceholderPage";
import type { ShellRouteProps } from "../types";

type PageTool = "chat" | "create" | "library";

const pageTools: Record<PageTool, { title: string; description: string }> = {
  chat: {
    title: "Chat",
    description: "Chat is ready for this page workspace.",
  },
  create: {
    title: "Create",
    description: "Create tools will appear here for this page.",
  },
  library: {
    title: "Library",
    description: "Your library for this page will have a home here soon.",
  },
};

export function PagePlaceholderPage({ user, onLogout }: ShellRouteProps) {
  const { pageId, tool = "chat" } = useParams<{
    pageId: string;
    tool: PageTool;
  }>();
  const pageTool = pageTools[tool];

  if (!pageId || !pageTool) {
    return null;
  }

  if (tool === "chat") {
    return <ChatPage user={user} onLogout={onLogout} pageId={pageId} />;
  }

  return (
    <PlaceholderPage
      user={user}
      onLogout={onLogout}
      title={pageTool.title}
      description={pageTool.description}
      sidebar="page"
      pageId={pageId}
      backTo="/pages"
    />
  );
}
