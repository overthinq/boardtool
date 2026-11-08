/**
 * Container with a title, to group related content.
 * @element ds-card
 * @attr {string} heading - Title of the card, rendered as an h2
 * @attr {"default"|"raised"} variant - Raised adds a shadow
 * @slot - Card content
 * @cssprop --card-padding - Inner spacing
 */
class DsCard extends HTMLElement {
  static observedAttributes = ["heading"];

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    this.render();
  }

  render() {
    const text = this.getAttribute("heading");
    let title = this.querySelector(":scope > .ds-card-heading");
    if (!text) {
      title?.remove();
      return;
    }
    if (!title) {
      title = document.createElement("h2");
      title.className = "ds-card-heading";
      this.prepend(title);
    }
    title.textContent = text;
  }
}

customElements.define("ds-card", DsCard);
