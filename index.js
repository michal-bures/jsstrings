//requires node 15!

import fg from 'fast-glob';
import path from 'path';
import estree from '@typescript-eslint/typescript-estree'
import fs from 'fs';
import LanguageDetect from 'languagedetect';
import chalk from 'chalk';
const languageDetector = new LanguageDetect();


const dir = path.resolve(process.argv[2]);

main(dir).catch(err => {
    console.error(err);
    process.exit(1);
});

async function main(dir) {
    const entries = await fg([
        `${dir}/**/*.ts`,
        '!**/node_modules']
    );

    entries.forEach(entry => {
        const code = fs.readFileSync(entry);
        const ast = estree.parse(code, { filePath: entry })

        //console.log(JSON.stringify(ast, null, 2));

        const strings = cleanupResults(extractStringsFromAst(ast));

        if (strings.length > 0) {
            console.log(chalk.bold(`${entry}`) + '\n  ' + strings.map(formatResults).join('\n  '))
        }
    });
}


function extractStringsFromAst(ast) {
    switch (ast.type) {
        case 'Literal':
            return [ast.value];
        case 'TemplateElement':
            return [ast.value.cooked];
        case 'TemplateLiteral':
            return [ extractStringsFromAstProps(ast).join(" ")];
        case 'ImportDeclaration':
            return [];
        default:
            return extractStringsFromAstProps(ast);
    }
}

function extractStringsFromAstProps(ast) {
    if (!ast || typeof ast !== 'object') return [];
    let results = [];
    for (let prop in ast) {
        const propValue = ast[prop];
        if (Array.isArray(propValue)) {
            results = results.concat(propValue.map(extractStringsFromAst).reduce((r1, r2) => r1.concat(r2), []));
        } else if (typeof propValue === 'object' && propValue !== null) {
            const newStrings = extractStringsFromAst(propValue);
            if (newStrings.length > 0) results = [ ...results, ...newStrings];
        }
    }
    return results;
}

function cleanupResults(results) {
    return results.filter(
            str => typeof str === 'string'
            && str.length>3
            && looksPossiblyCzech(str));
}

function looksPossiblyCzech(str) {
    const detectedLanguages = languageDetector.detect(str,20);
    const czechEntry = detectedLanguages.find(([lang, likelihood])=> lang === 'czech');
    const isLikelyCzech = !!czechEntry;
    return isLikelyCzech;
}

function formatResults(str) {
    return '• "' + str + '"';
}
