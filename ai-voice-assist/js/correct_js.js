const fs = require('fs');
const { ESLint } = require('eslint');

async function correctJS(code) {
    // Write code to a temp file
    fs.writeFileSync('temp.js', code);
    const eslint = new ESLint({ fix: true });
    const results = await eslint.lintFiles(['temp.js']);
    await ESLint.outputFixes(results);
    const fixedCode = fs.readFileSync('temp.js', 'utf-8');
    fs.unlinkSync('temp.js');
    return fixedCode;
}

if (require.main === module) {
    let code = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => code += chunk);
    process.stdin.on('end', async () => {
        try {
            const fixed = await correctJS(code);
            console.log(JSON.stringify({ corrected_code: fixed }));
        } catch (e) {
            console.log(JSON.stringify({ error: e.message }));
        }
    });
}
