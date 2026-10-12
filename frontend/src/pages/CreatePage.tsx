import { Link, useParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import type { ShellRouteProps } from "../types";

type CreatePageProps = ShellRouteProps & {
  pageId?: string;
};

type CreateItem = {
  label: string;
  description: string;
  to: string;
};

const sections: { heading: string; items: CreateItem[] }[] = [
  {
    heading: "Copilot",
    items: [
      {
        label: "Image",
        description: "Generate images with GPT image models.",
        to: "/create/gpt-image-gen",
      },
    ],
  },
  {
    heading: "RH",
    items: [
      {
        label: "Minimax H3 - FF Image to Video",
        description: "Turn a still image into a video with Minimax H3 (FF).",
        to: "/create/rh-minimax-h3-ff-image-to-video",
      },
    ],
  },
];

export function CreatePage({ user, onLogout, pageId }: CreatePageProps) {
  const { pageId: routePageId } = useParams<{ pageId?: string }>();
  const activePageId = pageId ?? routePageId;

  return (
    <AppShell
      user={user}
      onLogout={onLogout}
      pageTitle="Create"
      sidebar={activePageId ? "page" : "global"}
      pageId={activePageId}
      backTo={activePageId ? "/pages" : "/home"}
    >
      <div className="create-sections">
        {sections.map((section) => (
          <section className="panel create-section" key={section.heading}>
            <h3>{section.heading}</h3>
            <ul className="create-list">
              {section.items.map((item) => (
                <li key={item.to}>
                  <Link
                    className="create-item"
                    to={activePageId ? `/pages/${activePageId}${item.to}` : item.to}
                  >
                    <span className="create-item-text">
                      <strong>{item.label}</strong>
                      <span>{item.description}</span>
                    </span>
                    <span className="create-item-action">Open</span>
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
