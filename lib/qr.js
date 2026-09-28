import qrcodegen from "../vendor/qrcodegen.js";
import { el, dialog, alertBox, showError, input, field, form } from "./dom.js";
import { scannedRecordRoute } from "./urls.js";
export function qr(text, size = 84) {
  const code = qrcodegen.QrCode.encodeText(text, qrcodegen.QrCode.Ecc.MEDIUM),
    border = 4,
    ns = "http://www.w3.org/2000/svg",
    svg = document.createElementNS(ns, "svg");
  svg.setAttribute(
    "viewBox",
    `0 0 ${code.size + border * 2} ${code.size + border * 2}`,
  );
  svg.setAttribute("width", size);
  svg.setAttribute("height", size);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Verification QR code");
  svg.setAttribute("shape-rendering", "crispEdges");
  const title = document.createElementNS(ns, "title");
  title.textContent = text;
  svg.append(title);
  const background = document.createElementNS(ns, "rect");
  background.setAttribute("width", "100%");
  background.setAttribute("height", "100%");
  background.setAttribute("fill", "white");
  svg.append(background);
  const path = document.createElementNS(ns, "path");
  let d = "";
  for (let y = 0; y < code.size; y++)
    for (let x = 0; x < code.size; x++)
      if (code.getModule(x, y)) d += `M${x + border},${y + border}h1v1h-1z `;
  path.setAttribute("d", d);
  path.setAttribute("fill", "#153d34");
  svg.append(path);
  return svg;
}
export async function scan() {
  const video = el("video", {
      autoplay: true,
      playsinline: true,
      muted: true,
      class: "scanner-video",
    }),
    error = alertBox(),
    modal = dialog("Scan an ID card or receipt", [video, error]);
  let stream,
    frame,
    active = true;
  function stop() {
    active = false;
    cancelAnimationFrame(frame);
    stream?.getTracks().forEach((track) => track.stop());
  }
  modal.node.addEventListener("close", stop);
  const navigate = (text) => {
    const route = scannedRecordRoute(text);
    modal.close();
    location.hash = route;
  };
  modal.body.append(
    form(
      [
        field(
          "Or paste the QR link",
          input("url", "", { type: "url", required: true }),
        ),
      ],
      "Open record",
      async (data) => navigate(data.get("url")),
    ),
  );
  try {
    const [{ default: decode }, media] = await Promise.all([
      import("../vendor/jsqr.js"),
      navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      }),
    ]);
    stream = media;
    if (!active) {
      stop();
      return;
    }
    video.srcObject = stream;
    await video.play();
    const canvas = document.createElement("canvas"),
      ctx = canvas.getContext("2d", { willReadFrequently: true });
    let last = 0;
    function tick(now) {
      if (!active) return;
      if (now - last > 200 && video.readyState >= 2) {
        last = now;
        canvas.width = Math.min(video.videoWidth, 640);
        canvas.height = Math.round(
          (video.videoHeight * canvas.width) / video.videoWidth,
        );
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height),
          code = decode(pixels.data, canvas.width, canvas.height, {
            inversionAttempts: "attemptBoth",
          });
        if (code) {
          try {
            navigate(code.data);
            return;
          } catch (e) {
            showError(error, e);
          }
        }
      }
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
  } catch (e) {
    stop();
    showError(
      error,
      new Error(
        "Camera unavailable. Allow camera access on HTTPS, or paste the QR link below. " +
          e.message,
      ),
    );
  }
}
