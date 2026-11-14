import { Children, isValidElement, useEffect, useRef, useState } from "react";
import type { ComponentProps, ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";
import "highlight.js/styles/github.css";

type ChatMarkdownProps = {
  content: string;
  copyable?: boolean;
};

function getTextContent(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(getTextContent).join("");
  }
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return getTextContent(node.props.children);
  }
  return "";
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copyStatus, setCopyStatus] = useState<"copied" | "failed" | null>(
    null,
  );
  const timeoutRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    },
    [],
  );

  async function copyText() {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus("copied");
      timeoutRef.current = window.setTimeout(() => setCopyStatus(null), 1500);
    } catch {
      setCopyStatus("failed");
      timeoutRef.current = window.setTimeout(() => setCopyStatus(null), 3000);
    }
  }

  return (
    <span className="chat-copy-control">
      <button
        className="chat-copy-button"
        type="button"
        aria-label={copyStatus === "copied" ? "Copied" : label}
        title={copyStatus === "copied" ? "Copied" : label}
        onClick={() => void copyText()}
      >
        {copyStatus === "copied" ? (
          <Check size={14} aria-hidden="true" />
        ) : (
          <Copy size={14} aria-hidden="true" />
        )}
      </button>
      {copyStatus && (
        <span className="chat-copy-status" role="status">
          {copyStatus === "copied" ? "Copied" : "Copy failed"}
        </span>
      )}
    </span>
  );
}

function createComponents(copyable: boolean): Components {
  return {
    code({ children, className, ...props }) {
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },
    pre({ children, ...props }: ComponentProps<"pre">) {
      const codeElement = Children.toArray(children).find((child) =>
        isValidElement<{ className?: string }>(child),
      );
      const className =
        codeElement && isValidElement<{ className?: string }>(codeElement)
          ? codeElement.props.className
          : undefined;
      const language = className?.match(/language-([\w-]+)/)?.[1];

      return (
        <div className="chat-code-block">
          <div className="chat-code-header">
            <span>{language ?? "Code"}</span>
            {copyable && (
              <CopyButton text={getTextContent(children)} label="Copy code" />
            )}
          </div>
          <pre {...props}>{children}</pre>
        </div>
      );
    },
  };
}

export function ChatMarkdown({
  content,
  copyable = true,
}: ChatMarkdownProps) {
  const components = createComponents(copyable);

  return (
    <div className="chat-message-content chat-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: true }]]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export function ChatMessageCopyButton({ content }: { content: string }) {
  return <CopyButton text={content} label="Copy message" />;
}
