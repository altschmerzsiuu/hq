const fs = require('fs');
const glob = require('glob');
const babel = require('@babel/core');

const files = glob.sync('src/**/*.jsx');
let found = 0;

files.forEach(file => {
  const code = fs.readFileSync(file, 'utf8');
  try {
    const ast = babel.parseSync(code, {
      presets: ['@babel/preset-react'],
      plugins: ['@babel/plugin-syntax-jsx'],
      filename: file
    });
    
    babel.traverse(ast, {
      CallExpression(path) {
        if (
          path.node.callee.property &&
          path.node.callee.property.name === 'map'
        ) {
          const arg = path.node.arguments[0];
          if (arg && (arg.type === 'ArrowFunctionExpression' || arg.type === 'FunctionExpression')) {
            let body = arg.body;
            if (body.type === 'BlockStatement') {
              const retStmt = body.body.find(s => s.type === 'ReturnStatement');
              if (retStmt) body = retStmt.argument;
            }
            if (body && body.type === 'JSXElement') {
              const hasKey = body.openingElement.attributes.some(attr => attr.name && attr.name.name === 'key');
              if (!hasKey) {
                console.log(`Missing key in ${file}:${body.loc.start.line}`);
                found++;
              }
            } else if (body && body.type === 'JSXFragment') {
               console.log(`Fragment missing key in ${file}:${body.loc.start.line}`);
               found++;
            }
          }
        }
      }
    });
  } catch (e) {
    console.error(`Error parsing ${file}: ${e.message}`);
  }
});
console.log(`Total missing keys found: ${found}`);
