import { useRef, type KeyboardEvent } from "react";

type CodeEditorProps = {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  maxLength: number;
  ariaLabel: string;
};

export function CodeEditor({
  value,
  onChange,
  onSave,
  maxLength,
  ariaLabel,
}: CodeEditorProps) {
  const gutter = useRef<HTMLDivElement>(null);
  const lineCount = value.split("\n").length;
  const lineNumbers = Array.from({ length: lineCount }, (_, index) => index + 1);

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      onSave();
    }
  }

  return (
    <div className="code-editor">
      <div className="code-editor-gutter" ref={gutter} aria-hidden="true">
        {lineNumbers.map((line) => (
          <span key={line}>{line}</span>
        ))}
      </div>
      <textarea
        className="code-editor-input"
        value={value}
        maxLength={maxLength}
        spellCheck={false}
        wrap="off"
        aria-label={ariaLabel}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        onScroll={(event) => {
          if (gutter.current) {
            gutter.current.scrollTop = event.currentTarget.scrollTop;
          }
        }}
      />
    </div>
  );
}
