const path = require('node:path');

module.exports = function koreanTextPlugin({ types: t }) {
  return {
    name: 'maglev-korean-text',
    visitor: {
      Program: {
        exit(programPath, state) {
          const filename = state.file && state.file.opts && state.file.opts.filename;
          if (!filename || !path.isAbsolute(filename)) return;
          const localNames = [];
          for (const declaration of programPath.get('body')) {
            if (!declaration.isImportDeclaration() || declaration.node.source.value !== 'react-native') continue;
            const kept = [];
            for (const specifier of declaration.node.specifiers) {
              if (t.isImportSpecifier(specifier) &&
                  (t.isIdentifier(specifier.imported) ? specifier.imported.name : specifier.imported.value) === 'Text') {
                localNames.push(specifier.local.name);
              } else {
                kept.push(specifier);
              }
            }
            declaration.node.specifiers = kept;
            if (kept.length === 0) declaration.remove();
          }
          if (localNames.length === 0) return;
          const target = path.join(process.cwd(), 'components', 'ui', 'KoreanText');
          let source = path.relative(path.dirname(filename), target).split(path.sep).join('/');
          if (!source.startsWith('.')) source = './' + source;
          const imports = localNames.map((local) =>
            t.importSpecifier(t.identifier(local), t.identifier('KoreanText'))
          );
          programPath.unshiftContainer('body', t.importDeclaration(imports, t.stringLiteral(source)));
        },
      },
    },
  };
};
