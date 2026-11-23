export type ShotOptionGroup = { label: string; options: string[] };

/** Shot size is a single choice. */
export const SHOT_SIZE_GROUPS: ShotOptionGroup[] = [
  {
    label: "Close-ups",
    options: ["Close-up", "Medium Close-up", "Extreme Close-up", "Wide Close-up"],
  },
  {
    label: "Medium shots",
    options: ["Medium Shot", "Close Shot", "Medium Close Shot"],
  },
  {
    label: "Long shots",
    options: [
      "Wide Shot",
      "Extreme Wide Shot",
      "Full Shot",
      "Medium Full Shot",
      "Long Shot",
      "Extreme Long Shot",
    ],
  },
];

/** Shot type is a multi-choice. */
export const SHOT_TYPE_GROUPS: ShotOptionGroup[] = [
  {
    label: "Camera height",
    options: [
      "Eye Level",
      "Low Angle",
      "High Angle",
      "Overhead",
      "Shoulder Level",
      "Hip Level",
      "Knee Level",
      "Ground Level",
    ],
  },
  { label: "Dutch angle", options: ["Dutch (left)", "Dutch (right)"] },
  {
    label: "Framing",
    options: [
      "Single",
      "Two Shot",
      "Three Shot",
      "Over-the-Shoulder",
      "Over-the-Hip",
      "Point of View",
    ],
  },
  {
    label: "Focus / DOF",
    options: ["Rack Focus", "Shallow Focus", "Deep Focus", "Tilt-Shift", "Zoom"],
  },
];

/** Movement is a single choice. */
export const MOVEMENT_OPTIONS: string[] = [
  "Static",
  "Pan",
  "Tilt",
  "Swish Pan",
  "Swish Tilt",
  "Tracking",
];

export const SHOT_DURATION_MIN_SECONDS = 1;
export const SHOT_DURATION_MAX_SECONDS = 120;

/** Est. time from the reference shot list, stored as durationSeconds. */
export function validateShotDuration(value: string): {
  seconds: number | null;
  error: string | null;
} {
  const trimmed = value.trim();
  if (!trimmed) return { seconds: null, error: null };
  const seconds = Number(trimmed);
  if (
    !Number.isInteger(seconds) ||
    seconds < SHOT_DURATION_MIN_SECONDS ||
    seconds > SHOT_DURATION_MAX_SECONDS
  ) {
    return {
      seconds: null,
      error: `Est. time must be a whole number of seconds from ${SHOT_DURATION_MIN_SECONDS} to ${SHOT_DURATION_MAX_SECONDS}.`,
    };
  }
  return { seconds, error: null };
}
