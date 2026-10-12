import { useParams } from "react-router-dom";
import { PlaceholderPage } from "../components/PlaceholderPage";
import type { ShellRouteProps } from "../types";

type PageTool = "library";

const pageTools: Record<PageTool, { title: string; description: string }> = {
  library: {
    title: "Library",
    description: "Your library for this page will have a home here soon.",
  },
};

export function PagePlaceholderPage({ user, onLogout }: ShellRouteProps) {
  const { pageId, tool } = useParams<{
    pageId: string;
    tool: PageTool;
  }>();

  if (!pageId || (tool !== "library")) {
    return null;
  }

  const pageTool = pageTools[tool];

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
