import { el } from "./el.js";

// Every page can hide its sidebar: one choice for all of them, kept in the
// browser.
const KEY = "boardtool:sidebar";

const icon = el("span", { className: "icon" });
const toggle = el(
  "button",
  { type: "button", className: "sidebar-toggle icon-button" },
  icon,
);

function render(isHidden) {
  document.body.classList.toggle("sidebar-hidden", isHidden);
  const label = isHidden ? "Show sidebar" : "Hide sidebar";
  toggle.ariaLabel = label;
  toggle.title = label;
  icon.classList.toggle("icon-panel-left-open", isHidden);
  icon.classList.toggle("icon-panel-left-close", !isHidden);
}

toggle.addEventListener("click", () => {
  const isHidden = !document.body.classList.contains("sidebar-hidden");
  localStorage.setItem(KEY, isHidden ? "hidden" : "shown");
  render(isHidden);
});
document.querySelector("main").prepend(toggle);
render(localStorage.getItem(KEY) === "hidden");
