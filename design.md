# Design - NoxSafe

A locked design system for the NoxSafe marketing and application surfaces.

## Genre

Modern-minimal with a technical, austere security register.

## Macrostructure family

- Marketing pages: Map / Diagram with an H2 split-diptych opening.
- App pages: Workbench with task-first panels and persistent context.
- Content pages: Long Document with a readable 65ch measure.

## Theme

- Paper: `oklch(13% 0.022 252)`
- Raised paper: `oklch(17% 0.026 252)`
- Ink: `oklch(95% 0.012 245)`
- Secondary ink: `oklch(76% 0.032 248)`
- Rule: `oklch(30% 0.035 250)`
- Accent: `oklch(72% 0.12 244)`
- Focus: `oklch(82% 0.12 228)`

## Typography

- Display: Space Grotesk, weight 700, normal style.
- Body: IBM Plex Sans, weight 400.
- Mono: IBM Plex Mono, weight 400.
- Display tracking: `-0.035em`.
- Type anchor: `clamp(2.75rem, 5vw + 1rem, 5.25rem)`.

## Spacing and shape

Use the 4-point named scale in `frontend/tokens.css`. Cards use 12px radii,
controls use 8px radii, and compact metadata may use a full pill.

## Motion

- Enter: `cubic-bezier(0.16, 1, 0.3, 1)`.
- Exit: `cubic-bezier(0.7, 0, 0.84, 0)`.
- One orchestrated page entrance, direct state feedback, no decorative loops.
- Reduced motion uses opacity only and completes within 150ms.

## CTA voice

- Primary: light steel fill, dark text, compact verb-led copy.
- Secondary: one-pixel outline, transparent fill.
- Every control has visible focus, active, disabled, loading, error, and success states where applicable.

## Shared rules

- NoxSafe always leads. Arc Network is infrastructure.
- One steel-blue accent, used sparingly.
- No gradient headlines, generic glass panels, invented proof, or decorative status dots.
- Marketing may use the quorum diagram as product proof. App pages use function, not decoration.

