/**
 * Resource registry — MCP resource lifecycle management.
 *
 * Provides a simple `addResource()` method (matching the task interface)
 * and wires up the ListResources/ReadResource request handlers on the
 * MCP Server instance.
 *
 * @since 0.1.0
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListResourceTemplatesRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

export interface ResourceDef {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  load: () => string | Promise<string>;
}

export interface ResourceTemplateDef {
  uriTemplate: string;
  name: string;
  description?: string;
  mimeType?: string;
  /** Called when a URI matches this template; `vars` contains extracted path variables. */
  load: (uri: string, vars: Record<string, string>) => string | Promise<string>;
}

/**
 * Register a collection of static resources and/or resource templates onto an MCP Server.
 *
 * @param server  the MCP Server instance
 * @param resources  static resources (exact URI match)
 * @param templates  URI-template resources (RFC 6570 style, matched by simple pattern)
 */
export function setupResourceHandlers(
  server: Server,
  resources: ResourceDef[],
  templates?: ResourceTemplateDef[],
): void {
  // ── List static resources ──────────────────────────────────────
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: resources.map((r) => ({
      uri: r.uri,
      name: r.name,
      description: r.description,
      mimeType: r.mimeType,
    })),
  }));

  // ── List resource templates ────────────────────────────────────
  if (templates && templates.length > 0) {
    server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
      resourceTemplates: templates.map((t) => ({
        uriTemplate: t.uriTemplate,
        name: t.name,
        description: t.description,
        mimeType: t.mimeType,
      })),
    }));
  }

  // ── Read resource (static + template matching) ─────────────────
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params?.uri;
    if (!uri) {
      throw new Error('URI is required');
    }

    // 1. Try exact match on static resources
    const exact = resources.find((r) => r.uri === uri);
    if (exact) {
      const text = await exact.load();
      return {
        contents: [{ uri: exact.uri, mimeType: exact.mimeType ?? 'text/plain', text }],
      };
    }

    // 2. Try template matching
    if (templates) {
      for (const tpl of templates) {
        const vars = matchUriTemplate(tpl.uriTemplate, uri);
        if (vars) {
          const text = await tpl.load(uri, vars);
          return {
            contents: [{ uri, mimeType: tpl.mimeType ?? 'text/plain', text }],
          };
        }
      }
    }

    throw new Error(`Resource not found: ${uri}`);
  });
}

/**
 * Minimal RFC 6570 level-1 style URI template matcher.
 *
 * Supports templates like `luban://materials/{name}` — any path segment
 * wrapped in `{braces}` is treated as a variable.
 *
 * Returns extracted variables on match, or `null` if no match.
 */
function matchUriTemplate(
  template: string,
  uri: string,
): Record<string, string> | null {
  const tplParts = template.split('/');
  const uriParts = uri.split('/');

  if (tplParts.length !== uriParts.length) return null;

  const vars: Record<string, string> = {};
  for (let i = 0; i < tplParts.length; i++) {
    const tplSeg = tplParts[i];
    const uriSeg = uriParts[i];

    if (tplSeg.startsWith('{') && tplSeg.endsWith('}')) {
      const varName = tplSeg.slice(1, -1);
      vars[varName] = decodeURIComponent(uriSeg);
    } else if (tplSeg !== uriSeg) {
      return null;
    }
  }

  return vars;
}
