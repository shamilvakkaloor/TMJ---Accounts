const paths = {
  overview: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  people:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M16 3a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8",
  cards: "M3 5h18v14H3z M7 9h3v3H7z M6 16h5 M14 9h4 M14 13h4",
  funds: "M3 9l9-6 9 6H3z M5 10v8 M10 10v8 M14 10v8 M19 10v8 M3 21h18",
  receipt:
    "M5 3l2 1 2-1 3 1 3-1 2 1 2-1v18l-2-1-2 1-3-1-3 1-2-1-2 1V3z M8 8h8 M8 12h8 M8 16h5",
  wallet:
    "M20 8V5H4a2 2 0 0 0 0 4h17v11H4a2 2 0 0 1-2-2V7 M21 12h-6v5h6 M17 14.5h.01",
  chart: "M4 3v17h17 M8 15V9 M13 15V5 M18 15v-4",
  import: "M12 3v12 M7 10l5 5 5-5 M4 16v5h16v-5",
  activity: "M3 12h4l3-8 4 16 3-8h4",
  settings:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M10 2h4l1 3 3 1 3 3-2 3 2 3-3 3-3 1-1 3h-4l-1-3-3-1-3-3 2-3-2-3 3-3 3-1z",
  plus: "M12 5v14 M5 12h14",
  arrow: "M5 12h14 M13 6l6 6-6 6",
  refresh: "M20 7a9 9 0 1 0 1 9 M20 3v5h-5",
  exit: "M10 3H4v18h6 M9 12h12 M17 8l4 4-4 4",
  menu: "M4 6h16 M4 12h16 M4 18h16",
  close: "M6 6l12 12 M18 6L6 18",
};
export function icon(name, size = 20) {
  const ns = "http://www.w3.org/2000/svg",
    svg = document.createElementNS(ns, "svg");
  for (const [key, value] of Object.entries({
    viewBox: "0 0 24 24",
    width: size,
    height: size,
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "1.7",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "aria-hidden": "true",
    focusable: "false",
  }))
    svg.setAttribute(key, value);
  const path = document.createElementNS(ns, "path");
  path.setAttribute("d", paths[name] || paths.overview);
  svg.append(path);
  return svg;
}
