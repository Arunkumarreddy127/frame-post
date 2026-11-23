import { useEffect, useState, type ReactNode } from "react";
import { ChevronRight, Clapperboard, Image, Maximize2, Sparkles, type LucideIcon } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import type { CreationTool, ShellRouteProps, Workflow } from "../types";
import { getCatalog } from "../generationApi";
import { CreationTargetBanner, creationQuery } from "../components/creations/CreationTargetBanner";
import { parseCreationTool } from "../components/creations/shotTarget";
import { ACTION_TOOLS, actionLabel } from "../creationTools";

type CreatePageProps = ShellRouteProps & {
  pageId?: string;
};

type CreateItem = {
  label: string;
  description: string;
  to: string;
  tool: CreationTool;
  icon: ReactNode;
};

const TOOL_ICONS: Partial<Record<CreationTool, LucideIcon>> = {
  IMAGE: Sparkles,
  VIDEO: Clapperboard,
  UPSCALE: Maximize2,
};

const copilotItems: CreateItem[] = [
  {
    label: "Image",
    description: "Generate images with GPT image models.",
    to: "/create/gpt-image-gen",
    tool: "IMAGE",
    icon: <Image size={20} strokeWidth={1.8} aria-hidden="true" />,
  },
];

export function CreatePage({ user, onLogout, pageId }: CreatePageProps) {
  const { pageId: routePageId } = useParams<{ pageId?: string }>();
  const activePageId = pageId ?? routePageId;
  const [searchParams] = useSearchParams();
  const creationId = searchParams.get("creationId");
  const shotId = searchParams.get("shotId");
  const sceneId = searchParams.get("sceneId");
  const shotTool = parseCreationTool(searchParams.get("tool"));
  const query = creationQuery(creationId, { shotId, sceneId, tool: shotTool });
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    getCatalog()
      .then((catalog) => setWorkflows(catalog.runningHubWorkflows))
      .catch((caught: Error) => setLoadError(caught.message));
  }, []);

  const rhItems: CreateItem[] = workflows.map((workflow) => {
    const Icon = TOOL_ICONS[workflow.tool] ?? Sparkles;
    return {
      label: workflow.label,
      description: workflow.description,
      to: `/create/rh/${workflow.key}`,
      tool: workflow.tool,
      icon: <Icon size={20} strokeWidth={1.8} aria-hidden="true" />,
    };
  });

  const matchesTool = (item: CreateItem) => !shotTool || item.tool === shotTool;
  const allItems = [...copilotItems, ...rhItems];
  const sections: { heading: string; items: CreateItem[] }[] = ACTION_TOOLS.map(
    (tool) => ({
      heading: actionLabel(tool, workflows),
      items: allItems.filter((item) => item.tool === tool && matchesTool(item)),
    }),
  );
  const noMatch =
    Boolean(shotTool) && sections.every((section) => section.items.length === 0);

  return (
    <AppShell
      user={user}
      onLogout={onLogout}
      pageTitle="Create"
      sidebar={activePageId ? "page" : "global"}
      pageId={activePageId}
      backTo={activePageId ? "/pages" : "/home"}
    >
      <header className="app-page-header">
        <div>
          <p className="eyebrow">Create</p>
          <h1 className="app-page-title">Create</h1>
          <p className="app-page-description">
            Choose an image generator or workflow to create new work.
          </p>
        </div>
      </header>
      {creationId && (
        <CreationTargetBanner
          pageId={activePageId}
          creationId={creationId}
          shotId={shotId}
          sceneId={sceneId}
          tool={shotTool}
        />
      )}
      <div className="create-sections">
        {loadError ? (
          <p className="error" role="alert">
            {loadError}
          </p>
        ) : null}
        {noMatch ? (
          <p className="creation-view-hint">No generator is available for this tool yet.</p>
        ) : null}
        {sections
          .filter((section) => section.items.length > 0)
          .map((section) => (
            <section className="create-section" key={section.heading}>
              <h3>{section.heading}</h3>
              <ul className="create-list">
                {section.items.map((item) => (
                  <li key={item.to}>
                    <Link
                      className="create-item"
                      to={
                        (activePageId
                          ? `/pages/${activePageId}${item.to}`
                          : item.to) + query
                      }
                    >
                      <span className="create-item-icon">{item.icon}</span>
                      <span className="create-item-text">
                        <strong>{item.label}</strong>
                        <span>{item.description}</span>
                      </span>
                      <ChevronRight
                        className="create-item-chevron"
                        size={18}
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
      </div>
    </AppShell>
  );
}
