import {
  el,
  link,
  field,
  input,
  form,
  button,
  alertBox,
  showError,
} from "../lib/dom.js";
import { googleLogin, passwordLogin } from "../lib/auth.js";
import { store } from "../lib/store.js";
export function render() {
  const error = alertBox();
  const google = button(
    "Continue with Google",
    async () => {
      google.disabled = true;
      showError(error, "");
      try {
        await googleLogin();
        location.hash = "/admin";
      } catch (e) {
        showError(error, e);
      } finally {
        google.disabled = false;
      }
    },
    "button primary full",
  );
  return el(
    "div",
    { class: "login-page" },
    link("Mahal Accounts", "/", "public-brand"),
    el(
      "section",
      { class: "panel login-panel" },
      el("div", { class: "login-icon" }, "◇"),
      el("h1", {}, "Welcome back."),
      el("p", {}, "Administrator access to your community accounts."),
      store.admin
        ? link("Open workspace →", "/admin", "button primary full")
        : [
            google,
            error,
            el(
              "p",
              { class: "login-divider" },
              "or use your administrator user ID or email",
            ),
            form(
              [
                field(
                  "User ID or email",
                  input("userId", "", {
                    required: true,
                    autoComplete: "username",
                    autoCapitalize: "none",
                  }),
                ),
                field(
                  "Password",
                  input("password", "", {
                    type: "password",
                    required: true,
                    autoComplete: "current-password",
                  }),
                ),
              ],
              "Sign in securely",
              async (data) => {
                await passwordLogin(data.get("userId"), data.get("password"));
                location.hash = "/admin";
              },
            ),
          ],
      link("← Public member portal", "/", "back-link"),
    ),
    el("small", {}, "One community. Every contribution accounted for."),
  );
}
