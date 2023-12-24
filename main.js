#!/usr/bin/env node

const fs = require('fs');
const esprima = require('esprima-next');
const {visit} = require('ast-types');
const {parseArgs} = require("node:util");
const {join, dirname} = require('path');

const OUTPUTS = ['md', 'json'];

const {values: {path, output, help, sort, dependency}} = parseArgs({
  strict: true,
  options: {
    path: {
      type: 'string',
      short: 'p'
    },
    output: {
      type: 'string',
      short: 'o',
      default: 'md'
    },
    sort: {
      type: 'boolean',
      short: 's'
    },
    dependency: {
      type: 'boolean',
      short: 'd'
    },
    help: {
      type: 'boolean',
      short: 'h'
    }
  }
});

function printHelp(err) {
  console.log(`Options:
  -p,--path=''\t\tpath to javascript file(s)
  -o,--output=''\toutput (json|md) default md
  -s,--sort\toutput variables in alphabetical order
  -d,--dependency=false\tparse dependencies that use @fluidware-it/saddlebag
  -h,--help=false\tprint this help

Usage:
  ${process.argv[0]} ${process.argv[1]} -p path [options]
  `)
  process.exit(err ? 1 : 0);
}

if (help) {
  printHelp();
}

if (!path) {
  console.log(`Error:  must specify -p\n`)
  printHelp(true);
}

if (!OUTPUTS.includes(output)) {
  console.log(`Error: Unknown/unsupported output ${output}\n`)
  printHelp(true);
}

function isRequired(type) {
  switch (type) {
    case 'envStringRequired':
    case 'envIntRequired':
      return true;

    default:
      return false
  }
}

function getType(type) {
  switch (type) {
    case 'envString':
    case 'envStringRequired':
    case 'envStringOptions':
    case 'envStringOptional':
      return 'string';

    case 'envStringList':
      return 'string[]';

    case 'envBool':
      return 'boolean';

    case 'envIntRequired':
    case 'envInt':
      return 'integer'

    default:
      return `unknown (${type})`
  }
}

function printMD(data, depName) {
  const outs = [`
## ${depName ?? 'Environment variables'}
`];
  let maxColLength1 = 3;
  let maxColLength2 = 4;
  let maxColLength3 = 7;
  let maxColLength4 = 8;
  let maxColLength5 = 8;
  const ks = Object.keys(data);
  if (sort) {
    ks.sort();
  }
  ks.forEach(key => {
    const env = data[key];
    if (!env.key) return;
    maxColLength1 = Math.max(maxColLength1, env.key.length);
    maxColLength2 = Math.max(maxColLength2, (getType(env.type) || '').length);
    maxColLength3 = Math.max(maxColLength3, `${env.arg !== undefined ? env.arg : ''}`.length);
    maxColLength5 = Math.max(maxColLength5, `${env.comment !== undefined ? env.comment : ''}`.length);
  });
  const separator = `| ${''.padEnd(maxColLength1, '-')} | ${''.padStart(maxColLength2, '-')} | ${''.padStart(maxColLength3, '-')} | ${''.padStart(maxColLength4, '-')} | ${''.padStart(maxColLength5, '-')} |`;
  outs.push(`| ${'ENV'.padEnd(maxColLength1, ' ')} | ${'type'.padStart(maxColLength2, ' ')} | ${'default'.padStart(maxColLength3, ' ')} | required | ${'notes'.padStart(maxColLength5, ' ')} |`)
  outs.push(separator)
  ks.forEach(key => {
    const env = data[key];
    if (!env.key) return;
    outs.push(`| ${env.key.padEnd(maxColLength1, ' ')} | ${(getType(env.type) || '').padStart(maxColLength2, ' ')} | ${`${env.arg !== undefined ? env.arg : ''}`.padStart(maxColLength3, ' ')} | ${(isRequired(env.type) ? '*' : '').padStart(maxColLength4, ' ')} | ${`${env.comment !== undefined ? env.comment : ''}`.padStart(maxColLength5, ' ')} |`)
  })
  console.log(outs.join('\n'))
}

function scanSources(path) {
  const sources = [];

  try {
    const statPath = fs.statSync(path);
    if (statPath.isDirectory()) {
      const files = fs.readdirSync(path, {withFileTypes: true, recursive: true});
      for (const file of files) {
        if (file.isFile()) {
          if (file.name.endsWith('.js')) {
            sources.push(join(file.path, file.name));
          }
        }
      }
    } else {
      sources.push(path);
    }
  } catch (e) {
    console.error(`failed to open path ${path}: ${e.message}`);
    process.exit(1);
  }

  const data = {};

  for (const source of sources) {
    // console.log(`analyzing ${source}`)
    const sourceCode = fs.readFileSync(source).toString('utf-8');
    let ast;
    try {
      ast = esprima.parseScript(sourceCode, {comment: true, loc: true});
    } catch (e) {
      console.error(`Failed to parse ${source}: ${e.message}`);
      continue;
    }
    const comments = ast.comments ? ast.comments.map(c => c.value.trim()) : [];

    function getComment(name) {
      return comments.filter(c => c.startsWith(`${name}:`)).at(0);
    }

    visit(ast, {
      visitCallExpression(path) {
        const {callee, arguments} = path.node;
        if (callee.type === 'MemberExpression') {
          const {object} = callee;
          if (
            object?.property?.name === 'EnvParse'
          ) {
            let arg;
            const obj = {
              type: callee.property.name,
            }

            if (arguments[0].type === 'TemplateLiteral') {
              const expression = arguments[0].expressions[0].name
              const key = `${arguments[0].quasis[0].value.cooked}\${${expression}}${arguments[0].quasis[1].value.cooked}`;
              // console.log(JSON.stringify(arguments[0], null, 3));
              if (arguments[0].quasis.length === 2) {
                obj.key = key;

                arg = {
                  value: key
                }
                const commentKey = `${arguments[0].quasis[0].value.cooked}${arguments[0].quasis[1].value.cooked}`
                const comment = getComment(commentKey);
                if (comment) {
                  obj.comment = comment.replace(`${commentKey}:`, '').trim();
                }
              }
            } else {

              arg = arguments.shift();
              obj.key = arg.value;

              const comment = getComment(arg.value);
              if (comment) {
                obj.comment = comment.replace(`${arg.value}:`, '').trim();
              }
              obj.arg = arguments.map(arg => {
                if (arg.type === 'Literal') {
                  return arg.value
                } else if (arg.type === 'ArrayExpression') {
                  return arg.elements.map(arg => arg.value)
                }
              }).at(0)
            }
            if (obj) {
              data[obj.key] = obj
            }

          }
        }
        this.traverse(path);
      },
    });
  }
  return data;
}

const data = scanSources(path);
switch (output) {
  case 'md':
    printMD(data);
    break;

  case 'json':
  default:
    console.log(JSON.stringify(data, null, 3));
}

function scanDeps(dir) {
  const statPath = fs.statSync(dir);
  if (statPath.isDirectory()) {
    const files = fs.readdirSync(dir, {withFileTypes: true, recursive: false});
    for (const file of files) {
      if (file.isDirectory()) {
        const _packageJsonPath = join(file.path, file.name, 'package.json')
        if (!fs.existsSync(join(_packageJsonPath))) {
          scanDeps(join(dir, file.name));
          continue;
        }
        const packageJson = JSON.parse(fs.readFileSync(_packageJsonPath, 'utf8'));
        if (file.name === '')
          console.log('packageJson', packageJson)
        if (packageJson.dependencies?.['@fluidware-it/saddlebag']) {
          if (packageJson.main) {
            const _path = join(dir, file.name, packageJson.main);
            const _dir = dirname(_path);
            const data = scanSources(_dir);
            printMD(data, packageJson.name
              + '@' + packageJson.version);
          }
        }
      }
    }
  }
}

if (dependency) {
  try {
    scanDeps('node_modules')
  } catch (e) {
    console.error(`failed to open path ${path}: ${e.message}`);
    process.exit(1);
  }
}
