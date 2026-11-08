import { el } from "./el.js";

// Every page can hide its sidebar: one choice for all of them, kept in the
// browser.
const KEY = "boardtool:sidebar";

const toggle = el("button", { type: "button", className: "sidebar-toggle" });

function render(isHidden) {
  document.body.classList.toggle("sidebar-hidden", isHidden);
  toggle.textContent = isHidden ? "Show sidebar" : "Hide sidebar";
}

toggle.addEventListener("click", () => {
  const isHidden = !document.body.classList.contains("sidebar-hidden");
  localStorage.setItem(KEY, isHidden ? "hidden" : "shown");
  render(isHidden);
});
document.querySelector("main").prepend(toggle);
render(localStorage.getItem(KEY) === "hidden");
