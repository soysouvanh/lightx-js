import fs from "node:fs";
import path from "node:path";
import { secureResolve } from "./io_guard.ts";
import { tokenize } from "./tokenizer.ts";
import type { Token } from "./types.js";

const MAX_DEPTH = 10;
const MAX_TOTAL_INCLUDES = 200;

export function resolveDependencies(entryPath: string, rootDir: string): Token[] {
  let totalIncludes = 0;

  function processFile(filePath: string, depth: number, resolveStack: Set<string>): { tokens: Token[]; blocks: Map<string, Token[]>; extends: string | null } {
    if (depth > MAX_DEPTH) {
      throw new Error(`SECURITY: Max inclusion depth exceeded (${MAX_DEPTH})`);
    }
    if (totalIncludes > MAX_TOTAL_INCLUDES) {
      throw new Error(`SECURITY: Max total includes exceeded (${MAX_TOTAL_INCLUDES})`);
    }

    const securePath = secureResolve(filePath, rootDir);
    if (resolveStack.has(securePath)) {
      throw new Error(`SECURITY: Circular dependency detected - ${securePath}`);
    }

    resolveStack.add(securePath);
    totalIncludes++;

    const buffer = fs.readFileSync(securePath);
    const rawTokens = tokenize(buffer);

    let extendedPath: string | null = null;
    const localTokens: Token[] = [];
    const blocks = new Map<string, Token[]>();

    let currentBlock: string | null = null;
    let blockTokens: Token[] = [];

    for (const token of rawTokens) {
      if (token.type === "Extends") {
        if (currentBlock) throw new Error(`SYNTAX ERROR: 'extends' cannot be used inside a block in ${securePath}`);
        if (extendedPath) throw new Error(`SYNTAX ERROR: Multiple 'extends' directives in ${securePath}`);
        extendedPath = token.value;
      } else if (token.type === "Block") {
        if (currentBlock) throw new Error(`SYNTAX ERROR: Nested blocks are not allowed - '${token.value}' inside '${currentBlock}' in ${securePath}`);
        currentBlock = token.value;
        blockTokens = [];
        localTokens.push({ type: "Block", value: currentBlock, line: token.line });
      } else if (token.type === "EndBlock") {
        if (!currentBlock) throw new Error(`SYNTAX ERROR: 'endblock' outside of any block in ${securePath}`);
        blocks.set(currentBlock, blockTokens);
        currentBlock = null;
      } else if (token.type === "Include") {
        const includeRes = processFile(path.join(path.dirname(securePath), token.value), depth + 1, resolveStack);
        if (includeRes.extends) throw new Error(`SYNTAX ERROR: Included templates cannot extend layouts - ${token.value}`);
        
        for (const [bName, bTokens] of includeRes.blocks.entries()) {
          blocks.set(bName, bTokens);
        }

        if (currentBlock) {
          blockTokens.push(...includeRes.tokens);
        } else {
          localTokens.push(...includeRes.tokens);
        }
      } else if (currentBlock) {
        blockTokens.push(token);
      } else {
        localTokens.push(token);
      }
    }

    if (currentBlock !== null) {
      throw new Error(`SYNTAX ERROR: Unclosed block '${currentBlock}' in template ${securePath}`);
    }

    resolveStack.delete(securePath);
    return { tokens: localTokens, blocks, extends: extendedPath };
  }

  function resolveInheritance(entry: string): Token[] {
    const res = processFile(entry, 0, new Set<string>());
    
    let currentRes = res;
    let currentPath = entry;
    const inheritanceChain = [{ res: currentRes, path: currentPath }];

    while (currentRes.extends) {
      const parentPath = path.join(path.dirname(secureResolve(currentPath, rootDir)), currentRes.extends);
      currentPath = parentPath;
      currentRes = processFile(parentPath, inheritanceChain.length, new Set<string>());
      inheritanceChain.push({ res: currentRes, path: currentPath });
    }

    // Resolve from top to bottom of the inheritance chain
    let finalTokens = inheritanceChain[inheritanceChain.length - 1].res.tokens;
    const allKnownBlocks = new Map<string, Token[]>();

    for (let i = inheritanceChain.length - 1; i >= 0; i--) {
      const { res } = inheritanceChain[i];
      for (const [blockName, tokens] of res.blocks.entries()) {
        allKnownBlocks.set(blockName, tokens);
      }
    }

    // flatten blocks
    const flatTokens: Token[] = [];
    function flatten(tokens: Token[]) {
      for (const token of tokens) {
        if (token.type === "Block") {
           if (allKnownBlocks.has(token.value)) {
             flatten(allKnownBlocks.get(token.value)!);
           }
        } else {
           flatTokens.push(token);
        }
      }
    }
    
    // Only compile the root template's tokens which contains the layout/extends
    // If it has no layout, it compiles its own tokens.
    if (inheritanceChain.length > 1) {
       flatten(inheritanceChain[inheritanceChain.length - 1].res.tokens);
    } else {
       flatten(inheritanceChain[0].res.tokens);
    }

    return flatTokens;
  }

  return resolveInheritance(entryPath);
}
