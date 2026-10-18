/**
 * Generates public/sample.epub — a small, original EPUB 3 book with a cover image,
 * three chapters and a navigation document. Runs automatically before dev/build.
 */
import JSZip from 'jszip';
import { mkdir, writeFile } from 'node:fs/promises';

const TITLE = 'The Lantern Keeper';
const AUTHOR = 'Folio Press';
const UID = 'urn:uuid:7b1d0f3e-5a2c-4c1e-9a55-folio-sample-0001';

const chapters = [
  {
    id: 'ch1',
    title: 'I. The Tidewatch',
    paragraphs: [
      'Marrow Point had only one lighthouse and, by long custom, only one keeper. Ines took the post in the thin grey weeks after the equinox, when the sea seemed too weary to argue with the shore.',
      'The lamp room was a luminous cage of brass and glass, and every evening she climbed the one hundred and twelve steps to wake it. She trimmed the wick, polished the lens until it threw her own face back at her, and waited for the dusk to ripen.',
      'The old keeper had left a ledger beside the window. Its pages were a meticulous record of weather, ships, and silences, written in a hand so careful it looked almost like worry. On the last page he had added a single line: <em>Mind the third step. It remembers.</em>',
    ],
  },
  {
    id: 'ch2',
    title: 'II. What the Third Step Remembered',
    paragraphs: [
      'On her ninth night Ines stopped on the third step and listened. The stairwell was ancient and ambiguous in its sounds, but beneath the creak of iron she heard something gentler: a murmur, like a tide folded small enough to fit inside a stone.',
      'She pressed her palm to the step. Warmth crept up her wrist, and with it came a memory that was not hers — a storm, a bell, a lantern swinging from the hand of a girl who looked uncannily like herself.',
      'The girl was shouting a name across the water. Ines could not catch it, only the shape of it, the way one recognises a tune before the words arrive. When the vision faded she sat for a long time in the dark, her heart keeping time with the sea.',
    ],
  },
  {
    id: 'ch3',
    title: 'III. A Light for the Returning',
    paragraphs: [
      'By the first frost Ines understood the ledger. The keepers of Marrow Point did not only guide ships; they held the memories of those who had not come home, so that someone, somewhere, would always be waiting with a light.',
      'She wrote the girl\'s story into the ledger beneath the old keeper\'s line, in her own plain, unhurried handwriting. Then, because no one was watching, she said the half-heard name aloud into the wind.',
      'Far out on the horizon, a single pale lantern answered — once, twice, and steady. Ines smiled, trimmed the wick, and kept the light burning until morning, serene and entirely unafraid.',
    ],
  },
];

const css = `
html { font-family: Georgia, serif; }
body { margin: 0; padding: 0 1.2em; line-height: 1.6; }
h1, h2 { font-weight: 600; line-height: 1.25; margin: 1.6em 0 0.8em; }
h1 { font-size: 1.7em; text-align: center; }
h2 { font-size: 1.35em; }
p { margin: 0 0 1em; text-indent: 1.2em; hyphens: auto; }
p:first-of-type { text-indent: 0; }
.title-page { text-align: center; margin-top: 30vh; }
.title-page .author { margin-top: 2em; font-style: italic; opacity: 0.75; }
`;

const coverSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 900" width="600" height="900">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1b1f4a"/><stop offset="0.6" stop-color="#4b4f9e"/><stop offset="1" stop-color="#e29578"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#fff3b0" stop-opacity="0.95"/><stop offset="1" stop-color="#fff3b0" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="600" height="900" fill="url(#sky)"/>
  <g fill="#fff" opacity="0.85">
    <circle cx="90" cy="110" r="2"/><circle cx="470" cy="80" r="2.5"/><circle cx="330" cy="150" r="1.6"/>
    <circle cx="520" cy="210" r="1.8"/><circle cx="150" cy="240" r="1.4"/><circle cx="60" cy="330" r="1.8"/>
  </g>
  <circle cx="300" cy="400" r="190" fill="url(#glow)"/>
  <path d="M0 740 Q150 700 300 740 T600 740 V900 H0Z" fill="#12163a"/>
  <path d="M0 790 Q150 750 300 790 T600 790 V900 H0Z" fill="#0b0e26"/>
  <polygon points="262,740 338,740 322,470 278,470" fill="#f4efe6"/>
  <polygon points="270,640 330,640 327,590 273,590" fill="#c8553d"/>
  <polygon points="276,540 324,540 322,495 278,495" fill="#c8553d"/>
  <rect x="270" y="440" width="60" height="32" fill="#2a2d5c"/>
  <rect x="280" y="446" width="40" height="20" fill="#ffe99a"/>
  <polygon points="262,440 338,440 300,404" fill="#2a2d5c"/>
  <text x="300" y="150" text-anchor="middle" font-family="Georgia, serif" font-size="58" fill="#fdf6e3" letter-spacing="2">THE LANTERN</text>
  <text x="300" y="215" text-anchor="middle" font-family="Georgia, serif" font-size="58" fill="#fdf6e3" letter-spacing="2">KEEPER</text>
  <text x="300" y="850" text-anchor="middle" font-family="Georgia, serif" font-size="26" fill="#fdf6e3" opacity="0.9" letter-spacing="6">FOLIO PRESS</text>
</svg>`;

const xhtml = (title, body) => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en" xml:lang="en">
<head><meta charset="utf-8"/><title>${title}</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body>${body}</body>
</html>`;

const zip = new JSZip();
zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' }); // must be first and uncompressed

zip.file(
  'META-INF/container.xml',
  `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`,
);

zip.file('OEBPS/style.css', css);
zip.file('OEBPS/cover.svg', coverSvg);
zip.file(
  'OEBPS/titlepage.xhtml',
  xhtml(TITLE, `<div class="title-page"><h1>${TITLE}</h1><p class="author">${AUTHOR}</p></div>`),
);
for (const c of chapters) {
  zip.file(
    `OEBPS/${c.id}.xhtml`,
    xhtml(c.title, `<h2>${c.title}</h2>${c.paragraphs.map((p) => `<p>${p}</p>`).join('\n')}`),
  );
}

zip.file(
  'OEBPS/nav.xhtml',
  xhtml(
    'Contents',
    `<nav epub:type="toc" id="toc"><h1>Contents</h1><ol>
<li><a href="titlepage.xhtml">Title page</a></li>
${chapters.map((c) => `<li><a href="${c.id}.xhtml">${c.title}</a></li>`).join('\n')}
</ol></nav>`,
  ),
);

zip.file(
  'OEBPS/toc.ncx',
  `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:uid" content="${UID}"/></head>
  <docTitle><text>${TITLE}</text></docTitle>
  <navMap>
    <navPoint id="np0" playOrder="1"><navLabel><text>Title page</text></navLabel><content src="titlepage.xhtml"/></navPoint>
${chapters
  .map(
    (c, i) =>
      `    <navPoint id="np${i + 1}" playOrder="${i + 2}"><navLabel><text>${c.title}</text></navLabel><content src="${c.id}.xhtml"/></navPoint>`,
  )
  .join('\n')}
  </navMap>
</ncx>`,
);

zip.file(
  'OEBPS/content.opf',
  `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">${UID}</dc:identifier>
    <dc:title>${TITLE}</dc:title>
    <dc:creator>${AUTHOR}</dc:creator>
    <dc:language>en</dc:language>
    <dc:description>A short original story bundled with Folio as a sample book.</dc:description>
    <meta property="dcterms:modified">2026-01-01T00:00:00Z</meta>
    <meta name="cover" content="cover-image"/>
  </metadata>
  <manifest>
    <item id="cover-image" href="cover.svg" media-type="image/svg+xml" properties="cover-image"/>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="css" href="style.css" media-type="text/css"/>
    <item id="titlepage" href="titlepage.xhtml" media-type="application/xhtml+xml"/>
${chapters.map((c) => `    <item id="${c.id}" href="${c.id}.xhtml" media-type="application/xhtml+xml"/>`).join('\n')}
  </manifest>
  <spine toc="ncx">
    <itemref idref="titlepage"/>
${chapters.map((c) => `    <itemref idref="${c.id}"/>`).join('\n')}
  </spine>
</package>`,
);

const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', mimeType: 'application/epub+zip' });
await mkdir('public', { recursive: true });
await writeFile('public/sample.epub', buf);
console.log(`sample.epub written (${buf.length} bytes)`);
