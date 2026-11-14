import { Check, Copy } from "lucide-react";
import { useState } from "react";

type CopyPromptButtonProps = {
  prompt: string;
};

export function CopyPromptButton({ prompt }: CopyPromptButtonProps) {
  const [message, setMessage] = useState("");
  const copied = message === "Prompt copied.";

  async function copyPrompt() {
    setMessage("");
    try {
      if (!navigator.clipboard) {
        throw new Error("Clipboard access is unavailable in this browser.");
      }
      await navigator.clipboard.writeText(prompt);
      setMessage("Prompt copied.");
    } catch (caught) {
      setMessage(
        caught instanceof Error ? caught.message : "Unable to copy the prompt.",
      );
    }
  }

  return (
    <span className="copy-prompt-control">
      <button
        type="button"
        className="copy-prompt-button"
        onClick={copyPrompt}
        aria-label="Copy prompt"
      >
        {copied ? (
          <Check size={14} aria-hidden="true" />
        ) : (
          <Copy size={14} aria-hidden="true" />
        )}
        {copied ? "Copied" : "Copy"}
      </button>
      {message && (
        <span
          className={`copy-prompt-status${copied ? " sr-only" : " error"}`}
          role={copied ? "status" : "alert"}
        >
          {message}
        </span>
      )}
    </span>
  );
}
