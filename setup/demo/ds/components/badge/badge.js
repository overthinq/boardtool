/**
 * Short label for a status.
 * @element ds-badge
 * @attr {"ok"|"warning"|"alarm"} status - Status shown by the color
 * @slot - Label text
 */
class DsBadge extends HTMLElement {}

customElements.define("ds-badge", DsBadge);
