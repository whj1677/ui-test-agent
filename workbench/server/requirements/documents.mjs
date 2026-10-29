import path from 'node:path';
import { createHash } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';
import { SaxesParser } from 'saxes';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_XML_BYTES = 12 * 1024 * 1024;
const MAX_ZIP_ENTRIES = 256;
const MAX_EXPANDED_BYTES = 24 * 1024 * 1024;
const UTF8 = new TextDecoder('utf-8', { fatal: true });
const DRAWING_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const RELATION_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PACKAGE_RELATION_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const KIND_EXTENSIONS = Object.freeze({
  PRD: new Set(['.md', '.markdown', '.docx']),
  MRD: new Set(['.md', '.markdown', '.docx']),
  PROTOCOL: new Set(['.md', '.markdown', '.docx']),
  IMAGE: new Set(['.png', '.jpg', '.jpeg']),
});

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function fail(code) { throw new Error(code); }
function u16(bytes, at) { if (at < 0 || at + 2 > bytes.length) fail('REQUIREMENT_DOCX_TRUNCATED'); return bytes.readUInt16LE(at); }
function u32(bytes, at) { if (at < 0 || at + 4 > bytes.length) fail('REQUIREMENT_DOCX_TRUNCATED'); return bytes.readUInt32LE(at); }

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  return crc >>> 0;
});
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function safeZipName(name) {
  if (!name || name.includes('\\') || name.startsWith('/') || /^[a-z]:/i.test(name) ||
      name.split('/').some((part) => part === '..' || part === '.')) fail('REQUIREMENT_DOCX_UNSAFE_ENTRY');
}

function zipEntries(bytes) {
  if (bytes.length < 22 || u32(bytes, 0) !== 0x04034b50) fail('REQUIREMENT_DOCX_INVALID_ZIP');
  let eocd = -1;
  for (let at = bytes.length - 22; at >= Math.max(0, bytes.length - 65557); at -= 1) {
    if (u32(bytes, at) === 0x06054b50 && at + 22 + u16(bytes, at + 20) === bytes.length) { eocd = at; break; }
  }
  if (eocd < 0) fail('REQUIREMENT_DOCX_INVALID_ZIP');
  if (u16(bytes, eocd + 4) || u16(bytes, eocd + 6)) fail('REQUIREMENT_DOCX_MULTIDISK_UNSUPPORTED');
  const count = u16(bytes, eocd + 10);
  const directorySize = u32(bytes, eocd + 12);
  const directoryStart = u32(bytes, eocd + 16);
  if (count > MAX_ZIP_ENTRIES || count === 0 || count === 0xffff ||
      directorySize === 0xffffffff || directoryStart === 0xffffffff ||
      directoryStart + directorySize > eocd) fail('REQUIREMENT_DOCX_LIMIT_EXCEEDED');
  let cursor = directoryStart;
  let expanded = 0;
  const names = new Set();
  const result = new Map();
  for (let index = 0; index < count; index += 1) {
    if (u32(bytes, cursor) !== 0x02014b50 || cursor + 46 > eocd) fail('REQUIREMENT_DOCX_INVALID_DIRECTORY');
    const flags = u16(bytes, cursor + 8);
    const method = u16(bytes, cursor + 10);
    const checksum = u32(bytes, cursor + 16);
    const compressedSize = u32(bytes, cursor + 20);
    const size = u32(bytes, cursor + 24);
    const nameLength = u16(bytes, cursor + 28);
    const extraLength = u16(bytes, cursor + 30);
    const commentLength = u16(bytes, cursor + 32);
    const disk = u16(bytes, cursor + 34);
    const external = u32(bytes, cursor + 38);
    const local = u32(bytes, cursor + 42);
    const end = cursor + 46 + nameLength + extraLength + commentLength;
    if (end > eocd || disk || compressedSize === 0xffffffff || size === 0xffffffff ||
        local === 0xffffffff) fail('REQUIREMENT_DOCX_INVALID_DIRECTORY');
    const nameBytes = bytes.subarray(cursor + 46, cursor + 46 + nameLength);
    let name;
    try { name = UTF8.decode(nameBytes); } catch { fail('REQUIREMENT_DOCX_ENTRY_NAME_INVALID'); }
    safeZipName(name);
    const lowered = name.toLowerCase();
    if (names.has(lowered)) fail('REQUIREMENT_DOCX_DUPLICATE_ENTRY');
    names.add(lowered);
    const unixMode = external >>> 16;
    if ((unixMode & 0xf000) === 0xa000) fail('REQUIREMENT_DOCX_UNSAFE_ENTRY');
    if (flags & 0x0001 || ![0, 8].includes(method)) fail('REQUIREMENT_DOCX_UNSUPPORTED_COMPRESSION');
    if (size > MAX_XML_BYTES || (compressedSize && size / compressedSize > 200)) fail('REQUIREMENT_DOCX_LIMIT_EXCEEDED');
    expanded += size;
    if (expanded > MAX_EXPANDED_BYTES) fail('REQUIREMENT_DOCX_LIMIT_EXCEEDED');
    result.set(name, { local, flags, method, compressedSize, size, checksum, name });
    cursor = end;
  }
  if (cursor !== directoryStart + directorySize) fail('REQUIREMENT_DOCX_INVALID_DIRECTORY');
  return result;
}

function readZipEntry(bytes, entry) {
  const at = entry.local;
  if (u32(bytes, at) !== 0x04034b50 || u16(bytes, at + 8) !== entry.method) fail('REQUIREMENT_DOCX_LOCAL_MISMATCH');
  const nameLength = u16(bytes, at + 26);
  const extraLength = u16(bytes, at + 28);
  const start = at + 30 + nameLength + extraLength;
  const end = start + entry.compressedSize;
  if (end > bytes.length || end > bytes.length - 22) fail('REQUIREMENT_DOCX_TRUNCATED');
  let localName;
  try { localName = UTF8.decode(bytes.subarray(at + 30, at + 30 + nameLength)); } catch { fail('REQUIREMENT_DOCX_ENTRY_NAME_INVALID'); }
  if (localName !== entry.name) fail('REQUIREMENT_DOCX_LOCAL_MISMATCH');
  let output;
  try {
    output = entry.method === 0 ? bytes.subarray(start, end) :
      inflateRawSync(bytes.subarray(start, end), { maxOutputLength: MAX_XML_BYTES });
  } catch { fail('REQUIREMENT_DOCX_DECOMPRESSION_FAILED'); }
  if (output.length !== entry.size || crc32(output) !== entry.checksum) fail('REQUIREMENT_DOCX_INTEGRITY_FAILED');
  return output;
}

function wordSegments(xml) {
  if (/<!DOCTYPE|<!ENTITY|<\?xml-stylesheet/i.test(xml)) fail('REQUIREMENT_DOCX_XML_UNSAFE');
  const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const parser = new SaxesParser({ xmlns: true });
  const segments = [];
  const unsupported = new Set();
  const imageRefs = [];
  let inBody = false;
  let seenBody = false;
  let inText = false;
  let currentParagraph = null;
  let currentCell = null;
  let paragraph = 0;
  let table = 0;
  let tableDepth = 0;
  let row = 0;
  let cell = 0;
  parser.on('opentag', (tag) => {
    if (inBody && ((tag.uri === DRAWING_NS && tag.local === 'blip') ||
        (tag.uri === 'urn:schemas-microsoft-com:vml' && tag.local === 'imagedata'))) {
      const reference = Object.values(tag.attributes).find(attribute => attribute.uri === RELATION_NS && ['embed', 'link', 'id'].includes(attribute.local));
      if (reference) imageRefs.push({ relationship_id: reference.value,
        location: tableDepth ? { table, row, cell } : { paragraph: paragraph + 1 },
        linked: reference.local === 'link' });
      else unsupported.add('IMAGE_RELATION_MISSING');
    }
    if (tag.uri !== WORD_NS) return;
    const name = tag.local;
    if (name === 'body') { inBody = true; seenBody = true; return; }
    if (!inBody) return;
    if (['altChunk', 'txbxContent', 'ins', 'del', 'sdt'].includes(name)) unsupported.add(`${name.toUpperCase()}_MAY_BE_PARTIAL`);
    if (name === 'tbl') {
      tableDepth += 1;
      if (tableDepth === 1) { table += 1; row = 0; }
      else unsupported.add('NESTED_TABLE_MAY_BE_PARTIAL');
    } else if (name === 'tr' && tableDepth === 1) { row += 1; cell = 0; }
    else if (name === 'tc' && tableDepth === 1) { cell += 1; currentCell = { table, row, cell, paragraphs: [] }; }
    else if (name === 'p' && tableDepth <= 1) currentParagraph = { text: '' };
    else if (name === 't' && currentParagraph) inText = true;
    else if (name === 'tab' && currentParagraph) currentParagraph.text += '\t';
    else if (name === 'br' && currentParagraph) currentParagraph.text += '\n';
  });
  parser.on('text', (text) => { if (inText && currentParagraph) currentParagraph.text += text; });
  parser.on('closetag', (tag) => {
    if (tag.uri !== WORD_NS) return;
    const name = tag.local;
    if (name === 't') inText = false;
    else if (name === 'p' && currentParagraph && tableDepth <= 1) {
      const text = currentParagraph.text.trim();
      if (tableDepth === 1 && currentCell) {
        if (text) currentCell.paragraphs.push(text);
      } else {
        paragraph += 1;
        if (text) segments.push({ kind: 'paragraph', location: { paragraph }, text });
      }
      currentParagraph = null;
    } else if (name === 'tc' && tableDepth === 1 && currentCell) {
      const text = currentCell.paragraphs.join('\n');
      if (text) segments.push({ kind: 'table_cell', location: { table, row, cell }, text });
      currentCell = null;
    } else if (name === 'tbl') tableDepth -= 1;
    else if (name === 'body') inBody = false;
  });
  try { parser.write(xml).close(); } catch { fail('REQUIREMENT_DOCX_XML_INVALID'); }
  if (!seenBody) fail('REQUIREMENT_DOCX_BODY_MISSING');
  return { segments, unsupported: [...unsupported], imageRefs };
}

function imageMime(body, extension) {
  const png = extension === '.png' && body.length >= 24 && body.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = ['.jpg', '.jpeg'].includes(extension) && body.length >= 4 && body[0] === 0xff && body[1] === 0xd8 && body.at(-2) === 0xff && body.at(-1) === 0xd9;
  if (!png && !jpeg) fail('REQUIREMENT_IMAGE_INVALID');
  return png ? 'image/png' : 'image/jpeg';
}

function imageRelationships(xml) {
  if (/<!DOCTYPE|<!ENTITY|<\?xml-stylesheet/i.test(xml)) fail('REQUIREMENT_DOCX_XML_UNSAFE');
  const relationships = new Map();
  const parser = new SaxesParser({ xmlns: true });
  parser.on('opentag', tag => {
    if (tag.uri !== PACKAGE_RELATION_NS || tag.local !== 'Relationship') return;
    const values = Object.fromEntries(Object.values(tag.attributes).filter(attribute => !attribute.uri).map(attribute => [attribute.local, attribute.value]));
    if (!values.Id || relationships.has(values.Id)) fail('REQUIREMENT_DOCX_RELATION_INVALID');
    relationships.set(values.Id, values);
  });
  try { parser.write(xml).close(); } catch (error) {
    if (error.message === 'REQUIREMENT_DOCX_RELATION_INVALID') throw error;
    fail('REQUIREMENT_DOCX_XML_INVALID');
  }
  return relationships;
}

function docxImages(bytes, entries, refs) {
  const relEntry = entries.get('word/_rels/document.xml.rels');
  const relationships = relEntry ? imageRelationships(UTF8.decode(readZipEntry(bytes, relEntry))) : new Map();
  const images = new Map();
  const issues = [];
  const issue = (code, ref) => issues.push({ code, severity: 'COVERAGE_GAP', ...(ref ? { relationship_id: ref.relationship_id, location: ref.location } : {}) });
  for (const ref of refs) {
    const relation = relationships.get(ref.relationship_id);
    if (ref.linked || relation?.TargetMode === 'External') { issue('LINKED_IMAGE_UNANALYZED', ref); continue; }
    if (!relation || relation.Type !== `${RELATION_NS}/image`) { issue('IMAGE_RELATION_MISSING', ref); continue; }
    const target = relation.Target || '';
    // Document-part relationships may name /word/media/... or media/.... No
    // traversal, URL decoding, filesystem access or external fetch is involved.
    if (!target || /[\\%?#\u0000-\u001f]/.test(target) || target.split('/').some(part => part === '..' || part === '.') ||
        !/^(?:\/word\/)?media\/[^/]+$/.test(target)) fail('REQUIREMENT_DOCX_IMAGE_PATH_UNSAFE');
    const entryName = target.startsWith('/') ? target.slice(1) : `word/${target}`;
    const entry = entries.get(entryName);
    if (!entry) { issue('EMBEDDED_IMAGE_MISSING', ref); continue; }
    if (!['.png', '.jpg', '.jpeg'].includes(path.posix.extname(entryName).toLowerCase())) { issue('EMBEDDED_IMAGE_TYPE_UNANALYZED', ref); continue; }
    if (!images.has(entryName)) {
      const body = readZipEntry(bytes, entry);
      if (body.length > MAX_FILE_BYTES) fail('REQUIREMENT_IMAGE_LIMIT_EXCEEDED');
      images.set(entryName, { image_id: `image-${images.size + 1}`, entry_name: entryName,
        file_name: path.posix.basename(entryName), sha256: sha256(body), bytes: body.length,
        mime_type: imageMime(body, path.posix.extname(entryName).toLowerCase()), read_status: 'UNANALYZED',
        references: [], body });
    }
    images.get(entryName).references.push({ relationship_id: ref.relationship_id, location: ref.location });
  }
  if ([...entries.keys()].some(name => /^word\/media\//i.test(name) && !images.has(name))) issue('UNREFERENCED_OR_UNSUPPORTED_IMAGE_UNANALYZED');
  if (images.size) issue('EMBEDDED_IMAGE_UNANALYZED');
  return { images: [...images.values()], issues };
}

// Re-extract only from the immutable parent snapshot at request time. Derived
// bytes are not stored as independent sources and never become business quotes.
export function extractDocxImages(body) {
  const entries = zipEntries(body);
  const main = entries.get('word/document.xml');
  if (!main) fail('REQUIREMENT_DOCX_MAIN_MISSING');
  const parsed = wordSegments(UTF8.decode(readZipEntry(body, main)));
  return docxImages(body, entries, parsed.imageRefs).images;
}

function markdownSegments(text) {
  if (text.includes('\u0000')) fail('REQUIREMENT_TEXT_BINARY');
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const segments = [];
  let paragraph = [];
  let paragraphStart = 1;
  const flush = () => {
    const value = paragraph.join(' ').trim();
    if (value) segments.push({ kind: 'paragraph', location: { line: paragraphStart }, text: value });
    paragraph = [];
  };
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) { flush(); continue; }
    if (!paragraph.length) paragraphStart = index + 1;
    if (/^\|.*\|$/.test(line)) {
      flush();
      segments.push({ kind: 'table_row', location: { line: index + 1 }, text: line });
    } else paragraph.push(line);
  }
  flush();
  return segments;
}

export function inspectDocument({ kind, fileName, body }) {
  if (!KIND_EXTENSIONS[kind]) fail('REQUIREMENT_SOURCE_KIND_UNSUPPORTED');
  if (!Buffer.isBuffer(body) || !body.length || body.length > MAX_FILE_BYTES) fail('REQUIREMENT_SOURCE_SIZE_INVALID');
  const base = path.basename(fileName || '');
  if (!base || base !== fileName || /[\u0000-\u001f]/.test(base)) fail('REQUIREMENT_SOURCE_NAME_INVALID');
  const extension = path.extname(base).toLowerCase();
  if (!KIND_EXTENSIONS[kind].has(extension)) fail('REQUIREMENT_SOURCE_TYPE_UNSUPPORTED');
  const source = { file_name: base, extension, sha256: sha256(body), bytes: body.length };
  if (kind === 'IMAGE') {
    imageMime(body, extension);
    return { ...source, read_status: 'UNANALYZED', sections: { body: 'NOT_APPLICABLE', tables: 'NOT_APPLICABLE', images: 'UNANALYZED' }, segments: [], issues: [{ code: 'IMAGE_NOT_ANALYZED', severity: 'INFO' }] };
  }
  let segments;
  let issues = [];
  let embeddedImages = [];
  if (extension === '.docx') {
    const entries = zipEntries(body);
    if (entries.has('word/vbaProject.bin')) fail('REQUIREMENT_DOCX_MACRO_UNSUPPORTED');
    const main = entries.get('word/document.xml');
    if (!main || !entries.has('[Content_Types].xml')) fail('REQUIREMENT_DOCX_MAIN_MISSING');
    const xml = UTF8.decode(readZipEntry(body, main));
    const parsed = wordSegments(xml);
    segments = parsed.segments;
    issues = parsed.unsupported.map((code) => ({ code, severity: 'COVERAGE_GAP' }));
    const embedded = docxImages(body, entries, parsed.imageRefs);
    embeddedImages = embedded.images.map(({ body: _body, ...metadata }) => metadata);
    issues.push(...embedded.issues);
  } else {
    let text;
    try { text = UTF8.decode(body).replace(/^\uFEFF/, ''); } catch { fail('REQUIREMENT_TEXT_UTF8_INVALID'); }
    segments = markdownSegments(text);
    if (/!\[[^\]]*\]\([^)]*\)/.test(text)) issues.push({ code: 'LINKED_IMAGE_UNANALYZED', severity: 'COVERAGE_GAP' });
  }
  if (!segments.length) fail('REQUIREMENT_SOURCE_NO_READABLE_TEXT');
  const numbered = segments.map((segment, index) => ({
    segment_id: `segment-${index + 1}`, ...segment, quote_sha256: sha256(segment.text),
  }));
  const hasGap = issues.some((issue) => issue.severity === 'COVERAGE_GAP');
  const hasBodyGap = issues.some((issue) => issue.severity === 'COVERAGE_GAP' && !issue.code.includes('IMAGE'));
  return {
    ...source, read_status: hasGap ? 'PARTIAL' : 'READ',
    sections: { body: hasBodyGap ? 'PARTIAL' : 'READ', tables: hasBodyGap ? 'PARTIAL' : 'READ', images: issues.some((issue) => issue.code.includes('IMAGE')) ? 'UNANALYZED' : 'NOT_PRESENT' },
    segments: numbered, issues, ...(extension === '.docx' ? { embedded_images: embeddedImages } : {}),
  };
}
