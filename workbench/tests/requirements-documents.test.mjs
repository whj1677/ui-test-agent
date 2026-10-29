import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectDocument } from '../server/requirements/documents.mjs';

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function zip(entries) {
  const locals = [];
  const centers = [];
  let offset = 0;
  for (const [name, content] of entries) {
    const nameBytes = Buffer.from(name);
    const bytes = Buffer.from(content);
    const checksum = crc32(bytes);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(bytes.length, 18);
    local.writeUInt32LE(bytes.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    locals.push(local, nameBytes, bytes);
    const center = Buffer.alloc(46);
    center.writeUInt32LE(0x02014b50, 0);
    center.writeUInt16LE(20, 4);
    center.writeUInt16LE(20, 6);
    center.writeUInt32LE(checksum, 16);
    center.writeUInt32LE(bytes.length, 20);
    center.writeUInt32LE(bytes.length, 24);
    center.writeUInt16LE(nameBytes.length, 28);
    center.writeUInt32LE(offset, 42);
    centers.push(center, nameBytes);
    offset += local.length + nameBytes.length + bytes.length;
  }
  const central = Buffer.concat(centers);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, central, end]);
}
const TYPES = ['[Content_Types].xml', '<Types/>'];
const XML = '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
  '<w:p><w:r><w:t>重复编号必须拒绝</w:t></w:r></w:p>' +
  '<w:tbl><w:tr><w:tc><w:p><w:r><w:t>状态</w:t></w:r></w:p></w:tc>' +
  '<w:tc><w:p><w:r><w:t>拒绝</w:t></w:r></w:p></w:tc></w:tr></w:tbl>' +
  '</w:body></w:document>';

test('DOCX body and table are read with source locations', () => {
  const doc = inspectDocument({ kind: 'PRD', fileName: 'prd.docx', body: zip([TYPES, ['word/document.xml', XML]]) });
  assert.equal(doc.read_status, 'READ');
  assert.deepEqual(doc.segments.map((segment) => segment.text), ['重复编号必须拒绝', '状态', '拒绝']);
  assert.deepEqual(doc.segments[2].location, { table: 1, row: 1, cell: 2 });
});

test('DOCX refuses unsafe ZIP entries and XML entities', () => {
  assert.throws(() => inspectDocument({
    kind: 'MRD', fileName: 'mrd.docx', body: zip([TYPES, ['../word/document.xml', XML]]),
  }), /REQUIREMENT_DOCX_UNSAFE_ENTRY/);
  assert.throws(() => inspectDocument({
    kind: 'MRD', fileName: 'mrd.docx', body: zip([TYPES, ['word/document.xml', `<!DOCTYPE x [<!ENTITY x SYSTEM "file:///secret">]>${XML}`]]),
  }), /REQUIREMENT_DOCX_XML_UNSAFE/);
});

test('unsupported Word content is a visible coverage gap', () => {
  const xml = XML.replace('</w:body>', '<w:altChunk/></w:body>');
  const doc = inspectDocument({ kind: 'PRD', fileName: 'prd.docx', body: zip([TYPES, ['word/document.xml', xml]]) });
  assert.equal(doc.read_status, 'PARTIAL');
  assert.equal(doc.sections.body, 'PARTIAL');
  assert.ok(doc.issues.some((entry) => entry.code === 'ALTCHUNK_MAY_BE_PARTIAL'));
});

test('Markdown remains readable without an image; image bytes are only stored, not interpreted', () => {
  const markdown = inspectDocument({ kind: 'PRD', fileName: 'prd.md', body: Buffer.from('# 规则\n重复编号必须拒绝') });
  assert.equal(markdown.read_status, 'READ');
  assert.equal(markdown.sections.images, 'NOT_PRESENT');
  const image = inspectDocument({
    kind: 'IMAGE', fileName: 'screen.png',
    body: Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.alloc(16)]),
  });
  assert.equal(image.read_status, 'UNANALYZED');
  assert.equal(image.segments.length, 0);
});
