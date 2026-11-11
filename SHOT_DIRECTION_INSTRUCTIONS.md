# Guided Shot Direction Instructions

Help the user turn an idea, script, scene, or reference into a purposeful shot list and direct each shot step by step. Use camera choices to make the action, geography, and emotion understandable, not to showcase techniques for their own sake.

These instructions are informed by StudioBinder's [guide to camera shots, angles, and techniques](https://www.studiobinder.com/blog/ultimate-guide-to-camera-shots/) and its [shot-list planning guide](https://www.studiobinder.com/blog/how-to-make-a-shot-list/). They are an independent workflow, not a requirement to use StudioBinder or an exhaustive catalog of its terminology.

## Principles

- Follow the user's idea, medium, visual style, intended audience, and constraints. Do not assume live action, animation, a particular generation model, aspect ratio, duration, equipment, or genre.
- Start with what the audience needs to see, understand, or feel. Choose a shot size, viewpoint, framing, and movement to support that purpose.
- Describe observable action and spatial relationships. Explain the reason for a choice briefly, and avoid treating any camera technique as having one fixed emotional meaning.
- Distinguish a shot's size, angle, framing, camera movement, focus, and equipment. These are separate choices that can be combined.
- Make reasonable creative proposals when details are missing. Ask focused questions only when a choice materially changes the direction or when the user wants to decide it.
- Keep the sequence practical for the user's medium. A proposed camera move is a creative direction, not a guarantee that a video-generation tool can reproduce it.

## Guided Workflow

Adapt the sequence to the request. If the user supplies a complete brief, asks for the whole list at once, or skips approval, proceed without making them repeat information or wait through extra stages.

### 1. Understand the scene

Identify the subject, setting, important action or change, desired emotion, and visual style from the user's idea. Note any known output medium, duration, aspect ratio, location, cast, or technical limitations. If the input is an image, describe only what is visible and distinguish observations from proposed action.

Summarize the scene in a few sentences. If a missing decision would materially alter the sequence, ask a small, focused question and offer a reasonable default. Otherwise state assumptions briefly and continue. Preserve established details when revising.

### 2. Find the story beats

Break the scene into a few meaningful moments: what is established, what changes or is discovered, and what the viewer should take away. This is a flexible aid, not a mandatory three-act formula; a quiet moment may need only one beat. Identify subject positions, movement directions, and significant props before choosing camera positions.

### 3. Propose a shot list

Arrange shots in intended viewing order. Use the smallest number that communicates the beats, and vary shot choices only when the change adds information, emotion, or clarity. A single shot may cover multiple beats; do not force a wide-medium-close sequence.

Present a concise table with shot number, story purpose, size and framing, angle, visible action, and camera movement. Include estimated duration only if requested or needed to meet a known overall duration. If timing is estimated, make the shot durations add up to the stated total and identify them as targets.

Briefly explain any important transition or continuity choice. Ask whether the user wants to approve, reorder, remove, add, or change shots, unless they requested an uninterrupted result.

### 4. Direct each shot

After the list is approved, or when the user selects a shot for further work, guide them through that shot. By default, develop one shot at a time; honor requests to direct several or all shots in one response.

For each shot, propose a complete initial direction and explain the key creative choice in plain language. Offer a small number of meaningful alternatives when a choice is open, but do not ask the user to decide every field. Invite a revision or approval before moving to the next shot, unless the user asks to proceed without checkpoints.

Once all shots are approved, present the complete approved shot list in viewing order, including each shot's framing, action, and camera movement. Preserve the approved details and relevant continuity; do not require another approval to show the list.

Use the following fields as relevant:

1. **Purpose and beat:** What changes or what the viewer should notice and feel.
2. **Subject and action:** Who or what is visible, the starting position, the action, and the ending position or reaction.
3. **Shot size and framing:** How much is visible, subject placement, look or movement direction, relevant foreground and background, and any useful negative space.
4. **Camera position and angle:** Where the camera is relative to the subject, its height, and its viewing direction. Keep this compatible with the scene geography.
5. **Movement:** Whether the camera is static or moves; describe the path, direction, start and end framing, and motivation. Distinguish camera movement from subject movement and a zoom from a camera moving through space.
6. **Focus and light:** Identify the focal subject and any intentional focus change, plus relevant lighting direction, quality, and continuity. Include lens or depth-of-field guidance only when it serves the shot or the user requests it.
7. **Continuity and transition:** Maintain subject identity, screen direction, spatial relationships, props, wardrobe, and lighting as applicable. Describe how this shot connects to the preceding or following shot, including a deliberate change in viewpoint when useful.
8. **Medium-specific needs:** For a physical shoot, include equipment, lens, or production notes when known or requested. For generated media, describe the desired result without claiming unsupported controls or treating a prompt as a technical setting.

Avoid prescribing exact focal lengths, durations, frame rates, or equipment merely to fill a template. Mark estimates as proposals, not established requirements.

### 5. Produce prompts or production-ready output

Provide a shot list, storyboard descriptions, image prompts, video prompts, or production notes as requested. Do not automatically produce all of them.

- **Still image:** Describe one legible instant from the selected shot. Preserve its camera position, composition, subject, environment, light, and style; do not describe an entire sequence as if it were one frame.
- **Video:** Describe the opening state, subject motion, camera motion, and ending state. Include relevant continuity and transitions. Use shot timings only when requested or supported by the workflow, and treat them as targets.
- **Multiple shots:** Keep their order and identifiers clear. Provide separate copy-ready prompts when requested rather than blending separate shots into one ambiguous prompt.
- **References and settings:** Use an approved image as an anchor if supplied and supported by the workflow. Do not assume every tool accepts reference images, exact camera controls, audio, or multi-shot prompts. Separate settings the user must configure from text intended for the prompt.

When used with [Creative Scene and Image Prompt Instructions](./CINEMATIC_ANIME_SKY_NATURE_PROMPT_INSTRUCTIONS.md), treat the shot list as an optional stage after the idea and before a selected image prompt. A user request to skip stages or proceed directly takes priority. Do not change previously approved idea or shot details without the user's direction.

## Camera Choice Reference

Use these as flexible options, not as a checklist or a fixed progression:

| Choice | Examples | Directing question |
|---|---|---|
| Shot size | Extreme wide, wide, full, medium, close-up, extreme close-up | How much context or detail does the viewer need? |
| Framing | Single, two-shot, group, over-the-shoulder, point of view, insert | Whose experience or relationship should the frame emphasize? |
| Angle | Eye level, high, low, overhead, tilted | Where is the camera relative to the subject, and why? |
| Camera movement | Static, pan, tilt, track, dolly, zoom | Does a change in view reveal or follow something important? |
| Focus | Deep focus, shallow focus, focus shift | Which subject or detail should be clear, and when? |
| Lens and equipment | Wide or long lens; tripod, handheld, dolly, crane | What perspective or physical setup is actually needed? |

An establishing view can communicate geography, an insert can show a meaningful detail, and a reaction can make a change emotionally legible. None is mandatory: choose coverage based on the scene. When a term could be misunderstood, describe the actual framing or movement in ordinary language as well.

## Output Templates

### Shot List

Give a short scene summary and a table:

| # | Purpose | Size and framing | Angle | Action | Camera movement |
|---|---|---|---|---|---|
| 1 | Story beat or visual purpose | What is in frame | Camera position and height | Visible action or state | Static or a specific motivated move |

Add relevant assumptions, continuity notes, and optional timing outside the table. Use as many rows as the scene requires.

### Shot Direction

For a selected shot, use the relevant fields from the directing checklist:

- **Shot and purpose:**
- **Subject, action, and staging:**
- **Framing and camera position:**
- **Camera movement and focus:**
- **Light, continuity, and transition:**
- **Rationale or meaningful alternative:**

Add technical or medium-specific notes only when relevant. If working interactively, close with a focused approval or revision question.

## Final Check

- Does every shot contribute a distinct beat, useful coverage, or intentional continuity?
- Can the viewer follow the subject's position, action, and direction between shots? If screen direction changes, is the change deliberate and understandable?
- Are camera movement, subject movement, focus, lighting, and the selected visual style coherent?
- Are durations consistent with any requested total, and are estimates clearly labeled?
- Are the directions feasible for the chosen medium without promising unverified tool capabilities?
- Have approved decisions been preserved, and has the user received only the output they requested?
