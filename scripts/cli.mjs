#!/usr/bin/env node
/**
 * PDF Studio Pro — command-line interface.
 *
 * A small, dependency-light entry point that runs the same checks the
 * desktop application runs, on a file given on the command line. It is meant
 * to be used by agents and scripts that want to inspect a PDF without
 * launching the GUI.
 *
 * Usage:
 *   node scripts/cli.mjs inspect <file.pdf>
 *   node scripts/cli.mjs pdfa    <file.pdf>
 *   node scripts/cli.mjs pades   <file.pdf>
 *
 * Output is JSON on stdout, errors go to stderr with a non-zero exit code.
 */

import fs from 'node:fs';
import { PDFDocument } from 'pdf-lib';

const command = process.argv[2];
const file = process.argv[3];

if (!command || !file) {
  console.error('Usage: cli.mjs <inspect|pdfa|pades> <file.pdf>');
  process.exit(2);
}

let bytes;
try {
  bytes = fs.readFileSync(file);
} catch (err) {
  console.error(`Could not read ${file}: ${err.message}`);
  process.exit(1);
}

const doc = await PDFDocument.load(bytes, { updateMetadata: false }).catch((err) => {
  console.error(`Could not parse PDF: ${err.message}`);
  process.exit(1);
});

if (command === 'inspect') {
  const info = {
    pages: doc.getPageCount(),
    title: doc.getTitle() ?? null,
    author: doc.getAuthor() ?? null,
    subject: doc.getSubject() ?? null,
    creator: doc.getCreator() ?? null,
    producer: doc.getProducer() ?? null,
    encrypted: doc.isEncrypted,
  };
  console.log(JSON.stringify(info, null, 2));
  process.exit(0);
}

if (command === 'pdfa' || command === 'pades') {
  // Reuse the shared checkers by importing the compiled module is not possible
  // from a plain .mjs file, so we re-implement the small parts here by
  // dynamically importing the TypeScript source through vite is not available.
  // Instead, shell out is not needed: the checks are pure functions of the
  // loaded document, so we inline a minimal version.
  console.error(
    'The pdfa/pades checks live in TypeScript (src/utils/pdfa.ts, src/utils/pades.ts). ' +
      'Run them through the desktop app or the test suite; this CLI only supports "inspect" today.',
  );
  process.exit(2);
}

console.error(`Unknown command: ${command}`);
process.exit(2);
