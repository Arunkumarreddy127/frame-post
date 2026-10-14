import { useEffect, useState } from "react";
import type { RunningHubInput } from "../runninghubApi";

type DynamicInputFieldProps = {
  input: RunningHubInput;
  value: string;
  file: File | null;
  onValueChange: (value: string) => void;
  onFileChange: (file: File | null) => void;
};

export function DynamicInputField({ input, value, file, onValueChange, onFileChange }: DynamicInputFieldProps) {
  const label = input.required ? `${input.label} *` : input.label;

  if (input.type === "image" || input.type === "video") {
    return (
      <label className="workflow-field workflow-file-field">
        <span className="workflow-field-label">{label}</span>
        <input
          className="workflow-file-input"
          type="file"
          accept={input.accept?.join(",")}
          onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
        />
        {!file ? <span className="workflow-upload-hint">Choose a {input.type} file to get started</span> : null}
        <FilePreview file={file} kind={input.type} label={input.label} />
      </label>
    );
  }

  if (input.type === "textarea") {
    return (
      <label className="workflow-field">
        <span className="workflow-field-label">{label}</span>
        <textarea
          value={value}
          maxLength={input.maxLength ?? undefined}
          rows={5}
          onChange={(event) => onValueChange(event.target.value)}
        />
      </label>
    );
  }

  if (input.type === "select") {
    return (
      <label className="workflow-field">
        <span className="workflow-field-label">{label}</span>
        <select value={value} onChange={(event) => onValueChange(event.target.value)}>
          {(input.options ?? []).map((option) => (
            <option key={String(option)} value={String(option)}>
              {String(option)}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (input.type === "number") {
    return (
      <label className="workflow-field">
        <span className="workflow-field-label">{label}</span>
        <input
          type="number"
          value={value}
          min={input.min ?? undefined}
          max={input.max ?? undefined}
          onChange={(event) => onValueChange(event.target.value)}
        />
      </label>
    );
  }

  return (
    <label className="workflow-field">
      <span className="workflow-field-label">{label}</span>
      <input
        type="text"
        value={value}
        maxLength={input.maxLength ?? undefined}
        onChange={(event) => onValueChange(event.target.value)}
      />
    </label>
  );
}

function FilePreview({ file, kind, label }: { file: File | null; kind: "image" | "video"; label: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  if (!url) return null;
  if (kind === "video") {
    return <video src={url} controls aria-label={`${label} preview`} style={{ maxWidth: "320px", borderRadius: "8px" }} />;
  }
  return <img src={url} alt={`${label} preview`} style={{ maxWidth: "320px", borderRadius: "8px" }} />;
}

/**
 * Initial value for an input: its declared default, else the first option, else empty.
 */
export function initialValueFor(input: RunningHubInput): string {
  if (input.default !== null && input.default !== undefined) return String(input.default);
  if (input.type === "select" && input.options && input.options.length > 0) return String(input.options[0]);
  return "";
}
