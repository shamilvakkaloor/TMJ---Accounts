// Raster cards keep browser-rendered Malayalam/other Unicode text identical in PDF.
// Small PDF 1.4 writer: one JPEG XObject per page, no font or runtime dependency.
export function cardPdf(images) {
  if (!images.length) throw new Error("No cards to export.");
  const encoder = new TextEncoder(), parts = [], offsets = [0];
  let length = 0;
  const add = (value) => {
    const bytes = typeof value === "string" ? encoder.encode(value) : value;
    parts.push(bytes); length += bytes.length;
  };
  const object = (id, body) => { offsets[id] = length; add(`${id} 0 obj\n`); body(); add("\nendobj\n"); };
  const width = 85.6 * 72 / 25.4, height = 54 * 72 / 25.4;
  add("%PDF-1.4\n");
  object(1, () => add("<< /Type /Catalog /Pages 2 0 R >>"));
  object(2, () => add(`<< /Type /Pages /Count ${images.length} /Kids [${images.map((_, i) => `${3 + i * 3} 0 R`).join(" ")}] >>`));
  images.forEach((image, i) => {
    const page = 3 + i * 3, content = page + 1, photo = page + 2;
    object(page, () => add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Card ${photo} 0 R >> >> /Contents ${content} 0 R >>`));
    const commands = `q ${width} 0 0 ${height} 0 0 cm /Card Do Q`;
    object(content, () => add(`<< /Length ${encoder.encode(commands).length} >>\nstream\n${commands}\nendstream`));
    object(photo, () => {
      add(`<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>\nstream\n`);
      add(image.bytes); add("\nendstream");
    });
  });
  const start = length;
  add(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`);
  for (const offset of offsets.slice(1)) add(`${String(offset).padStart(10, "0")} 00000 n \n`);
  add(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`);
  return new Blob(parts, { type: "application/pdf" });
}
