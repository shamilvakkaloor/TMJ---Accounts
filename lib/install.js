import { button, dialog, el } from "./dom.js";

let pendingPrompt;
let installedThisSession = false;
const standalone = matchMedia("(display-mode: standalone)");
const installed = () => installedThisSession || standalone.matches || navigator.standalone === true;
function updateButtons() {
  document.querySelectorAll("[data-install-app]").forEach((node) => {
    node.hidden = installed();
  });
}
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  pendingPrompt = event;
  updateButtons();
});
window.addEventListener("appinstalled", () => {
  installedThisSession = true;
  pendingPrompt = undefined;
  document.querySelectorAll("[data-install-app]").forEach((node) => { node.hidden = true; });
});
standalone.addEventListener("change", updateButtons);

export function installButton() {
  return button("Install Mahal app", async () => {
    if (pendingPrompt) {
      const prompt = pendingPrompt;
      pendingPrompt = undefined;
      try {
        await prompt.prompt();
        await prompt.userChoice;
        return;
      } catch {
        // Fall back to the browser's installation menu if the prompt expired.
      }
    }
    const modal = dialog("Install Mahal Accounts", [
      el("p", {}, "In Chrome, use the install icon at the right of the address bar, or open ⋮ → Cast, save and share → Install page as app. Confirm Install to add Mahal Accounts to your computer and open it in its own window."),
      el("p", {}, "On Android, open Chrome’s menu and choose Install app or Add to Home screen. On iPhone or iPad, use Safari → Share → Add to Home Screen."),
      el("p", {}, "An internet connection is needed to sign in and work with your accounts."),
    ]);
    modal.body.append(button("Close", modal.close));
  }, "button secondary", { "data-install-app": "", hidden: installed() });
}
