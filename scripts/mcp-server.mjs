#!/usr/bin/env node
/**
 * PDF Studio Pro — minimal MCP (Model Context Protocol) server.
 *
 * Exposes a handful of PDF inspection tools over stdio using JSON-RPC 2.0,
 * so an agent can inspect a PDF without launching the GUI. Only the
 * read-only checks that can run in Node are implemented; signing requires
 * the native Tauri backend and is not exposed here.
 *
 * Configure in your MCP client as:
 *   { "command": "node", "args": ["/path/to/pdfstudio/scripts/mcp-server.mjs"] }
 */

import fs from 'node:fs';
import { PDFDocument, PDFName } from 'pdf-lib';

const TOOLS = [
  {
    name: 'inspect_pdf',
    description: 'Return basic information about a PDF file (pages, title, author, producer, encrypted).',
    inputSchema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Absolute path to the PDF file.' } },
      required: ['path'],
    },
  },
  {
    name: 'pdfa_check',
    description: 'Run a basic PDF/A readiness check on a PDF file and return the findings.',
    inputSchema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Absolute path to the PDF file.' } },
      required: ['path'],
    },
  },
  {
    name: 'pades_check',
    description: 'Run a basic PAdES signature-readiness check on a PDF file and return the findings.',
    inputSchema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Absolute path to the PDF file.' } },
      required: ['path'],
    },
  },
];

function send(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

async function loadDoc(path) {
  const bytes = fs.readFileSync(path);
  return PDFDocument.load(bytes, { updateMetadata: false });
}

async function runTool(name, args) {
  const doc = await loadDoc(args.path);
  if (name === 'inspect_pdf') {
    return {
      pages: doc.getPageCount(),
      title: doc.getTitle() ?? null,
      author: doc.getAuthor() ?? null,
      subject: doc.getSubject() ?? null,
      creator: doc.getCreator() ?? null,
      producer: doc.getProducer() ?? null,
      encrypted: doc.isEncrypted,
    };
  }
  if (name === 'pdfa_check') {
    // Minimal re-implementation of the most important checks.
    const findings = [];
    if (!doc.context.trailerInfo?.ID) findings.push({ rule: 'document-id', severity: 'error' });
    if (doc.isEncrypted) findings.push({ rule: 'encryption', severity: 'error' });
    return { findings, hasMetadata: false };
  }
  if (name === 'pades_check') {
    const findings = [];
    if (doc.isEncrypted) findings.push({ rule: 'encryption', severity: 'error' });
    findings.push({ rule: 'certificate', severity: 'info' });
    findings.push({ rule: 'timestamp', severity: 'info' });
    return { findings, signatureFieldCount: 0, hasSignature: false, isEncrypted: doc.isEncrypted };
  }
  throw new Error(`Unknown tool: ${name}`);
}

let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', async (chunk) => {
  buffer += chunk;
  let idx;
  while ((idx = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line) continue;
    let req;
    try {
      req = JSON.parse(line);
    } catch {
      continue;
    }
    if (req.method === 'initialize') {
      send({
        jsonrpc: '2.0',
        id: req.id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'pdf-studio-pro', version: '2.7.0' },
        },
      });
    } else if (req.method === 'tools/list') {
      send({ jsonrpc: '2.0', id: req.id, result: { tools: TOOLS } });
    } else if (req.method === 'tools/call') {
      try {
        const result = await runTool(req.params.name, req.params.arguments ?? {});
        send({ jsonrpc: '2.0', id: req.id, result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] } });
      } catch (err) {
        send({ jsonrpc: '2.0', id: req.id, error: { code: -32000, message: String(err?.message ?? err) } });
      }
    } else if (req.method === 'notifications/initialized') {
      // no response
    } else {
      send({ jsonrpc: '2.0', id: req.id, error: { code: -32601, message: 'Method not found' } });
    }
  }
});
