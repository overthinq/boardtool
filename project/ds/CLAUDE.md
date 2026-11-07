# DS rules
- Tokens: DTCG, three tiers (primitive / semantic / component). Every token has $type and $description.
- Semantic tokens reference primitives. Components and boards never use primitives.
- Component = folder with <name>.js, <name>.css, <name>.md. Tag prefix `ds-`, light DOM.
- Document the API in JSDoc (@element, @attr, @slot, @cssprop). Guidelines and ```html examples in <name>.md.
- connectedCallback must be idempotent. Render native interactive elements inside the component.
- Register every new component in `ds/components/index.js` and `ds/components/index.css`.
