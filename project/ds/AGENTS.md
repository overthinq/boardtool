# DS rules
- Tokens: DTCG, three tiers (primitive / semantic / component). Every token has `$type` and `$description`.
- Semantic tokens reference primitives. Components and boards never use primitives.
- Colors in `srgb` always include `hex`.
- Text colors have a `text` segment in their path, surfaces a `surface` segment (`color.text.primary`, `color.surface.base`): the viewer checks every text color on every surface.
- Typography tokens: `font: var(--x)` plus `letter-spacing: var(--x-letter-spacing)`.
- Component = folder in `ds/components/` with `<name>.js`, `<name>.css`, `<name>.md`. Tag prefix `ds-`, light DOM.
- Document the API in JSDoc (@element, @attr, @slot, @cssprop, @fires). Guidelines and ```` ```html ```` examples in `<name>.md`.
- `connectedCallback` must be idempotent. Render native interactive elements inside the component.
- Register every new component in `ds/components/index.js` and `ds/components/index.css`.
