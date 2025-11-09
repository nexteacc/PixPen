# Repository Guidelines

## Project Structure & Ownership
`App.tsx` drives the single-page UI, composing building blocks from `components/` with the segmentation tools in `src/components/`. Keep service logic in `services/` and `src/services/`, and declare shared interfaces in `types.ts` or `src/types/`. Global styles sit in `index.css`; feature-specific styles stay beside their component. Only `public/` ships with the app—`dist/` remains disposable build output.

## Model Behavior & Service Boundaries
`services/geminiService.ts` remains the sole gateway to Google Gemini, translating files into API payloads, enforcing safety checks, and returning data URLs. Reinforce prompt rules and error branches here rather than in components. `src/services/segmentationService.ts` owns mask detection, alignment, and merging; extend it with typed helpers instead of duplicating math inside the UI.

## Development Workflow
Use `npm install` to pull dependencies. `npm run dev` launches the Vite server with hot reload, while `npm run build` and `npm run preview` confirm production bundles. Store secrets like `VITE_API_KEY` in `.env.local`; Vite surfaces them through `import.meta.env`.

## Coding Style & Naming
Favor composable TypeScript React components built on hooks. Match the prevailing two-space indentation, single quotes, and deliberate trailing commas. Name components and types with `PascalCase`, functions and variables with `camelCase`, and environment keys with `SCREAMING_SNAKE_CASE`. Keep side effects in dedicated hooks and move reusable logic into `services/` or colocated utilities.

## Testing & Quality Checks
Current quality gates are manual: follow `TESTING_CHECKLIST.md` and extend it when behavior changes. Before opening a PR, walk through Gemini requests, segmentation merges, and expected failure states. Confirm `npm run build` passes each time. If you add automated coverage, colocate specs (e.g., `ObjectSelectCanvas.test.tsx`) and expose them through an `npm` script.

## Commits & Pull Requests
Write Conventional Commits like the existing `feat(segmentation): …` and `refactor(ui): …`, using scopes that reflect directories or domains. Pull requests must summarize intent, list verification steps, and include before/after visuals for UI tweaks. Reference issues, flag risks such as prompt updates or mask math shifts, and secure peer review before merge.

## Security & Configuration
Do not commit secrets or user-derived assets. Load keys such as `VITE_API_KEY` from `.env.local`, and avoid logging prompts or raw imagery. Remove sensitive artifacts from history quickly and rotate credentials after demos. When adding configuration, document required env variables or setup steps in the touched module or README.
