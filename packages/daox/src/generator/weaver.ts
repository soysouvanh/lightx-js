import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';

export function weaveOverride(
  safeTable: string,
  entity: string,
  generatedContent: string,
  outDir: string
): string {
  const outDirRelative = path.relative(path.join(process.cwd(), 'src', 'dao'), outDir);
  const overridePath = path.join(process.cwd(), 'src', 'overrides', outDirRelative, 'dao', `${safeTable}.dao.ts`);
  
  if (!fs.existsSync(overridePath)) {
    return generatedContent;
  }

  const overrideContent = fs.readFileSync(overridePath, 'utf8');
  
  const genAst = ts.createSourceFile('gen.ts', generatedContent, ts.ScriptTarget.Latest, true);
  const overAst = ts.createSourceFile('over.ts', overrideContent, ts.ScriptTarget.Latest, true);

  const getMethodSignatures = (ast: ts.SourceFile, className: string) => {
    let targetClass: ts.ClassDeclaration | undefined;
    
    ts.forEachChild(ast, (node) => {
      if (ts.isClassDeclaration(node) && node.name?.text === className) {
        targetClass = node;
      }
    });

    const methods = new Map<string, { methodNode: ts.MethodDeclaration, signature: string, pos: number, end: number }>();
    if (!targetClass) return { methods, classEnd: -1 };

    for (const member of targetClass.members) {
      if (ts.isMethodDeclaration(member) && member.name) {
        const name = member.name.getText(ast);
        
        const hasStatic = member.modifiers?.some(m => m.kind === ts.SyntaxKind.StaticKeyword) || false;
        const hasAsync = member.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword) || false;
        
        const params = member.parameters.map((p) => {
          const q = p.questionToken ? '?' : '';
          const t = p.type ? p.type.getText(ast) : 'any';
          return (q + t).replace(/\s+/g, '');
        }).join(',');
        
        const rt = member.type ? member.type.getText(ast).replace(/\s+/g, '') : 'any';
        const modifiers = (hasStatic ? 'static ' : '') + (hasAsync ? 'async ' : '');
        const signature = `${modifiers}(${params}):${rt}`;
        
        methods.set(name, {
          methodNode: member,
          signature,
          pos: member.getStart(ast),
          end: member.getEnd()
        });
      }
    }
    return { methods, classEnd: targetClass.end - 1 };
  };

  const genMetaResult = getMethodSignatures(genAst, `${entity}Dao`);
  const overMetaResult = getMethodSignatures(overAst, `${entity}Dao`);

  const genMethods = genMetaResult.methods;
  const overMethods = overMetaResult.methods;

  if (overMethods.size === 0) {
    return generatedContent;
  }

  const replacements: Array<{start: number, end: number, text: string}> = [];
  let overridesCount = 0;
  let extensionsCount = 0;

  for (const [name, overMeta] of overMethods.entries()) {
    const genMeta = genMethods.get(name);
    
    if (!genMeta) {
      // It's an Extension: Inject the new custom method at the end of the generated class
      replacements.push({
        start: genMetaResult.classEnd,
        end: genMetaResult.classEnd,
        text: '\n  ' + overMeta.methodNode.getText(overAst) + '\n'
      });
      extensionsCount++;
      continue;
    }

    if (overMeta.signature !== genMeta.signature) {
      throw new Error(`\n[WEAVE FATAL] Signature mismatch for method '${name}' in ${safeTable}.dao.ts.
  Expected: ${genMeta.signature}
  Found:    ${overMeta.signature}
Fix your override to match the expected AOT generated signature.\n`);
    }

    replacements.push({
      start: genMeta.pos,
      end: genMeta.end,
      text: overMeta.methodNode.getText(overAst)
    });
    overridesCount++;
  }

  replacements.sort((a, b) => b.start - a.start);

  let finalContent = generatedContent;
  for (const r of replacements) {
    finalContent = finalContent.slice(0, r.start) + r.text + finalContent.slice(r.end);
  }

  console.log(`[Daox Weaver] Injected ${overridesCount} override(s) and ${extensionsCount} extension(s) into ${safeTable}.dao.ts`);
  return finalContent;
}
