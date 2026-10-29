export const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64');
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
export function zip(entries) {
  const locals = [], centers = []; let offset = 0;
  for (const [name, content] of entries) {
    const nameBytes = Buffer.from(name), bytes = Buffer.from(content), checksum = crc32(bytes);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(bytes.length, 18); local.writeUInt32LE(bytes.length, 22); local.writeUInt16LE(nameBytes.length, 26);
    locals.push(local, nameBytes, bytes);
    const center = Buffer.alloc(46);
    center.writeUInt32LE(0x02014b50); center.writeUInt16LE(20, 4); center.writeUInt16LE(20, 6);
    center.writeUInt32LE(checksum, 16); center.writeUInt32LE(bytes.length, 20); center.writeUInt32LE(bytes.length, 24);
    center.writeUInt16LE(nameBytes.length, 28); center.writeUInt32LE(offset, 42);
    centers.push(center, nameBytes); offset += local.length + nameBytes.length + bytes.length;
  }
  const central = Buffer.concat(centers), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(central.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, central, end]);
}
const esc = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
export function docxFixture({ images = [{ name: 'prototype.png', body: PNG }], references = null, extraEntries = [], rule = '重复编号必须拒绝。图片仅用于确认页面布局，不定义业务规则。', relationshipXml = null } = {}) {
  const refs = references || images.map((image, index) => ({ id: `rId${index + 1}`, target: `media/${image.name}` }));
  const document = `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body><w:p><w:r><w:t>${esc(rule)}</w:t></w:r></w:p>${refs.filter(ref => ref.visible !== false).map(ref => `<w:p><w:r><w:drawing><a:blip r:${ref.link ? 'link' : 'embed'}="${esc(ref.id)}"/></w:drawing></w:r></w:p>`).join('')}</w:body></w:document>`;
  const relationships = relationshipXml || `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${refs.map(ref => `<Relationship Id="${esc(ref.id)}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${esc(ref.target)}"${ref.external ? ' TargetMode="External"' : ''}/>`).join('')}</Relationships>`;
  return zip([['[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'],
    ['word/document.xml', document], ['word/_rels/document.xml.rels', relationships], ...images.map(image => [`word/media/${image.name}`, image.body]), ...extraEntries]);
}
