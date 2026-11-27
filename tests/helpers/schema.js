// Parses prisma/schema.prisma into a DMMF-like model list (name, fields, relationFromFields)
// so tests can derive the same configuration the app derives from Prisma.dmmf at runtime.
import { readFileSync } from 'node:fs';

export function modelsFromSchema() {
  const text = readFileSync(new URL('../../prisma/schema.prisma', import.meta.url), 'utf8');
  return [...text.matchAll(/^model ([^\s{]+) \{([\s\S]*?)^\}/gm)].map(([, name, body]) => ({
    name,
    fields: body.split('\n').map(l => l.trim()).filter(l => /^\w/.test(l)).map(l => {
      const [fieldName] = l.split(/\s+/);
      const rel = l.match(/@relation\([^)]*fields:\s*\[([^\]]*)\]/);
      return { name: fieldName, relationFromFields: rel ? rel[1].split(',').map(s => s.trim()) : undefined };
    }),
  }));
}
