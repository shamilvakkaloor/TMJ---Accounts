import qrcodegen from "../vendor/qrcodegen.js";
import { appUrl } from "./urls.js";
import { cardPdf } from "./card-pdf.js";

const W = 1600, H = 1010, GREEN = "#005849", INK = "#082b2b";
function rounded(ctx, x, y, w, h, r, fill, stroke) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
}
function text(ctx, value, x, y, width, height, size = 38, weight = 650, color = INK, maxLines = 2) {
  const raw = String(value || "—");
  let lines;
  for (; size >= 10; size--) {
    ctx.font = `${weight} ${size}px "Manrope", "Segoe UI", sans-serif`;
    lines = [""];
    for (const word of raw.split(/(\s+)/)) {
      if (ctx.measureText(lines.at(-1) + word).width <= width) lines[lines.length - 1] += word;
      else if (ctx.measureText(word).width <= width) lines.push(word.trimStart());
      else for (const char of word) {
        if (ctx.measureText(lines.at(-1) + char).width > width) lines.push("");
        lines[lines.length - 1] += char;
      }
    }
    if (lines.length <= maxLines && lines.length * size * 1.25 <= height) break;
  }
  ctx.fillStyle = color; ctx.textBaseline = "top";
  lines.forEach((line, i) => ctx.fillText(line.trim(), x, y + i * size * 1.25));
}
function person(ctx, x, y, size) {
  ctx.fillStyle = GREEN;
  ctx.beginPath(); ctx.arc(x, y - size * .23, size * .2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x, y + size * .24, size * .34, size * .27, 0, Math.PI, Math.PI * 2); ctx.lineTo(x + size * .34, y + size * .45); ctx.lineTo(x - size * .34, y + size * .45); ctx.fill();
}
function mosque(ctx, x, y, scale, opacity, color = "#159e88") {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale); ctx.globalAlpha = opacity; ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(-120, 0); ctx.bezierCurveTo(-120, -100, -10, -110, 0, -180); ctx.bezierCurveTo(10, -110, 120, -100, 120, 0); ctx.closePath(); ctx.fill();
  ctx.fillRect(-120, 0, 240, 70);
  for (const side of [-1, 1]) {
    ctx.fillRect(side * 170 - 13, -120, 26, 190);
    ctx.beginPath(); ctx.moveTo(side * 170 - 24, -120); ctx.lineTo(side * 170, -160); ctx.lineTo(side * 170 + 24, -120); ctx.fill();
    ctx.fillRect(side * 170 - 21, -60, 42, 9);
  }
  ctx.beginPath(); ctx.arc(0, -206, 24, .45, 5.1); ctx.arc(11, -217, 24, 4.2, 1.8, true); ctx.fill();
  ctx.restore();
}
function background(ctx) {
  const wash = ctx.createLinearGradient(0, 0, W, H); wash.addColorStop(0, "#ffffff"); wash.addColorStop(.48, "#f5fcfb"); wash.addColorStop(1, "#c3eae0");
  rounded(ctx, 0, 0, W, H, 55, wash);
  ctx.save(); ctx.beginPath(); ctx.roundRect(0, 0, W, H, 55); ctx.clip();
  // Quiet geometric ornament, behind the details and high-contrast QR panel.
  ctx.strokeStyle = "#d1eee6"; ctx.lineWidth = 2;
  for (let y = 0; y < H; y += 60) for (let x = 880; x < W; x += 60) {
    ctx.beginPath(); ctx.moveTo(x, y - 25); ctx.lineTo(x + 25, y); ctx.lineTo(x, y + 25); ctx.lineTo(x - 25, y); ctx.closePath(); ctx.stroke();
  }
  mosque(ctx, 1320, 455, 1.1, .24); mosque(ctx, 1020, 505, .65, .11);
  const green = ctx.createLinearGradient(700, 0, W, H); green.addColorStop(0, "#008e77"); green.addColorStop(1, "#003f38");
  const gold = ctx.createLinearGradient(0, 0, W, 0); gold.addColorStop(0, "#f6dda3"); gold.addColorStop(.5, "#bd9043"); gold.addColorStop(1, "#fff0ba");
  ctx.fillStyle = gold; ctx.beginPath(); ctx.moveTo(1100, 0); ctx.bezierCurveTo(1150, 115, 1310, 140, 1380, 145); ctx.lineTo(1380, 195); ctx.bezierCurveTo(1490, 195, 1555, 280, 1600, 365); ctx.lineTo(W, 0); ctx.fill();
  ctx.fillStyle = green; ctx.beginPath(); ctx.moveTo(1125, 0); ctx.bezierCurveTo(1180, 100, 1330, 120, 1400, 125); ctx.lineTo(1400, 174); ctx.bezierCurveTo(1500, 180, 1565, 255, W, 310); ctx.lineTo(W, 0); ctx.fill();
  ctx.fillStyle = gold; ctx.beginPath(); ctx.moveTo(0, 900); ctx.bezierCurveTo(450, 1150, 1010, 930, W, 770); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
  ctx.fillStyle = green; ctx.beginPath(); ctx.moveTo(0, 920); ctx.bezierCurveTo(450, 1160, 1010, 948, W, 788); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
  ctx.strokeStyle = "#edd49b"; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(1050, H); ctx.bezierCurveTo(1330, 835, 1480, 884, W, 981); ctx.stroke();
  ctx.restore();
}
function row(ctx, label, value, y, icon = "•") {
  rounded(ctx, 65, y, 965, 74, 37, "#ffffffdc", "#d7ece7");
  rounded(ctx, 73, y + 7, 60, 60, 30, "#cceee5");
  text(ctx, icon, 88, y + 15, 40, 48, 35, 700, GREEN, 1);
  text(ctx, label, 159, y + 24, 240, 42, 27, 500, "#344e50", 1);
  text(ctx, value, 445, y + 12, 560, 57, 38, 750);
}
export async function renderCard(model) {
  await document.fonts.ready;
  const canvas = document.createElement("canvas"); canvas.width = W; canvas.height = H;
  canvas.className = "generated-id-card";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", `${model.type} ID card for ${model.name}, ${model.id}, page ${model.page} of ${model.pages}`);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
  background(ctx);
  rounded(ctx, 65, 55, 138, 138, 30, GREEN);
  ctx.save(); ctx.beginPath(); ctx.roundRect(65, 55, 138, 138, 30); ctx.clip();
  mosque(ctx, 134, 164, .28, 1, "#fff"); ctx.restore();
  text(ctx, "Mahal", 236, 66, 300, 100, 82, 800);
  text(ctx, "App", 505, 66, 210, 100, 82, 800, "#008c76");
  text(ctx, "C O M M U N I T Y   •   C A R E   •   T O G E T H E R", 242, 164, 850, 32, 21, 600);
  text(ctx, model.mahal.toUpperCase(), 65, 238, 1440, 102, 69, 800, INK, 2);
  rounded(ctx, 65, 343, 168, 10, 5, "#d5ad62");
  text(ctx, `${model.type.toUpperCase()}  I D  C A R D`, 65, 370, 950, 45, 29, 550, "#344e50", 1);
  if (model.type === "member") {
    rounded(ctx, 65, 446, 142, 142, 71, "#caeee5"); person(ctx, 136, 510, 108);
    text(ctx, "M E M B E R  N A M E", 237, 436, 780, 40, 25, 600);
    text(ctx, model.name, 237, 476, 812, 110, 65, 800, INK, 2);
    row(ctx, "MEMBER ID", model.id, 602, "#");
    row(ctx, "HOUSE ID", model.houseId, 680, "⌂");
    row(ctx, "SUB MAHAL", model.subMahal, 758, "◇");
    row(ctx, "CARE OF", model.careOf, 836, "♡");
  } else {
    row(ctx, "House ID", model.id, 430, "⌂");
    row(ctx, "House name", model.name, 508, "⌂");
    row(ctx, "House no.", model.number, 586, "#");
    rounded(ctx, 65, 681, 965, 242, 30, "#ffffffda", "#d7ece7");
    rounded(ctx, 65, 681, 965, 52, [25, 25, 0, 0], GREEN);
    text(ctx, `House members (${model.memberCount})`, 93, 688, 890, 40, 31, 700, "#fff", 1);
    if (!model.members.length) text(ctx, "No members registered", 97, 775, 865, 65, 34, 500);
    model.members.forEach((member, i) => {
      const x = 80 + (i % 2) * 475, y = 748 + Math.floor(i / 2) * 55;
      rounded(ctx, x, y, 456, 50, 25, "#f2fbf8", "#e0f0eb");
      person(ctx, x + 29, y + 22, 32);
      text(ctx, member.name + (member.active ? "" : " (inactive)"), x + 60, y + 4, 380, 44, 28, 650);
    });
  }
  const url = appUrl(`/p/${model.type}/${model.id}`);
  const code = qrcodegen.QrCode.encodeText(url, qrcodegen.QrCode.Ecc.MEDIUM);
  rounded(ctx, 1107, 497, 415, 415, 38, "#ffffff", "#91d9c8");
  const cell = Math.floor(391 / (code.size + 8));
  const size = cell * (code.size + 8), left = 1107 + (415 - size) / 2, top = 497 + (415 - size) / 2;
  ctx.fillStyle = "#000";
  for (let y = 0; y < code.size; y++) for (let x = 0; x < code.size; x++)
    if (code.getModule(x, y)) ctx.fillRect(Math.round(left + (x + 4) * cell), Math.round(top + (y + 4) * cell), cell, cell);
  rounded(ctx, 1107, 919, 415, 34, 17, "#ffffffed");
  text(ctx, "Scan to view the current record", 1126, 924, 385, 28, 18, 650, GREEN, 1);
  if (model.pages > 1) text(ctx, `Page ${model.page} of ${model.pages} • ${model.id}`, 80, 945, 850, 28, 21, 650, GREEN, 1);
  return canvas;
}
export async function pngBlob(canvas) {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Image export failed.")), "image/png"));
}
export async function pdfBlob(canvases) {
  const images = await Promise.all(canvases.map(async (canvas) => {
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", .98));
    if (!blob) throw new Error("PDF image export failed.");
    return { width: canvas.width, height: canvas.height, bytes: new Uint8Array(await blob.arrayBuffer()) };
  }));
  return cardPdf(images);
}
