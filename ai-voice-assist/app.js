import 'dotenv/config';
import express from 'express';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import http from 'http';
import os from 'os';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();
const port = process.env.PORT || 3000;

// Spawn the Python Flask correction server on startup
const pathToPyServer = path.join(__dirname, 'python', 'server.py');
let pyServerProcess = null;
try {
    pyServerProcess = spawn('python', [pathToPyServer], {
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe']
    });

    pyServerProcess.stdout.on('data', (data) => {
        console.log(`[py-server stdout] ${data.toString()}`);
    });

    pyServerProcess.stderr.on('data', (data) => {
        console.error(`[py-server stderr] ${data.toString()}`);
    });

    pyServerProcess.on('close', (code) => {
        console.log(`Python server exited with code ${code}`);
        pyServerProcess = null;
    });
} catch (err) {
    console.error('Failed to start python server:', err);
}

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));



// Routes
app.post('/api/process-command', async (req, res) => {
    const { command, code } = req.body;
    
    try {
        // Ensure GEMINI_API_KEY is set
        if (!process.env.GEMINI_API_KEY) {
            throw new Error('GEMINI_API_KEY environment variable is not set');
        }

        // Spawn Python process for NLP processing with Gemini
        const pythonProcess = spawn('python', [
            path.join(__dirname, 'python', 'process_command.py'),
            command,
            code
        ], {
            env: {
                ...process.env,
                GEMINI_API_KEY: process.env.GEMINI_API_KEY
            }
        });

        let result = '';
        let error = '';

        pythonProcess.stdout.on('data', (data) => {
            result += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            error += data.toString();
        });

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                return res.status(500).json({ error: error || 'Processing failed' });
            }
            
            try {
                // Parse the JSON response
                const parsedResult = JSON.parse(result);
                res.json(parsedResult);
            } catch (parseError) {
                res.status(500).json({ error: 'Invalid response format' });
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/execute', async (req, res) => {
    const { code, language } = req.body;
    if (!language) {
        return res.status(400).json({ error: 'No language provided' });
    }

    const lang = language.toLowerCase();

    try {
        if (lang === 'python') {
            // Spawn Python runner which returns JSON {output, error}
            const pythonProcess = spawn('python', [
                path.join(__dirname, 'python', 'execute_code.py'),
                code
            ]);

            let resultStr = '';
            let error = '';

            pythonProcess.stdout.on('data', (data) => {
                resultStr += data.toString();
            });

            pythonProcess.stderr.on('data', (data) => {
                error += data.toString();
            });

            pythonProcess.on('close', (exitCode) => {
                if (exitCode !== 0) {
                    // If python runner returned non-zero, try to parse stdout for info, else send stderr
                    try {
                        const parsed = JSON.parse(resultStr || '{}');
                        return res.status(500).json(parsed);
                    } catch (e) {
                        return res.status(500).json({ error: error || 'Execution failed' });
                    }
                }

                // Parse the JSON string the python script prints
                try {
                    const parsed = JSON.parse(resultStr);
                    return res.json(parsed);
                } catch (e) {
                    return res.json({ output: resultStr });
                }
            });

        } else if (lang === 'javascript' || lang === 'js') {
            // Execute JavaScript by writing to a temp file and running node
            const tmpDir = os.tmpdir();
            const tmpName = `ai_exec_${Date.now()}_${Math.random().toString(36).slice(2)}.js`;
            const tmpPath = path.join(tmpDir, tmpName);

            fs.writeFileSync(tmpPath, code, 'utf8');

            const nodeProcess = spawn('node', [tmpPath]);
            let output = '';
            let error = '';

            // Safety: kill if runs too long
            const killTimer = setTimeout(() => {
                try { nodeProcess.kill('SIGKILL'); } catch (e) {}
                error += '\nProcess killed after timeout';
            }, 5000);

            nodeProcess.stdout.on('data', (data) => { output += data.toString(); });
            nodeProcess.stderr.on('data', (data) => { error += data.toString(); });

            nodeProcess.on('close', (exitCode) => {
                clearTimeout(killTimer);
                // remove temp file
                try { fs.unlinkSync(tmpPath); } catch (e) {}

                if (exitCode !== 0) {
                    return res.status(500).json({ error: error || 'Execution failed' });
                }
                return res.json({ output });
            });

        } else {
            // Handle C and C++ compilation and execution
            if (lang === 'c' || lang === 'cpp' || lang === 'c++') {
                const tmpPrefix = path.join(os.tmpdir(), 'ai_exec_');
                const tmpDir = fs.mkdtempSync(tmpPrefix);
                try {
                    const isCpp = (lang === 'cpp' || lang === 'c++');
                    const srcName = isCpp ? 'prog.cpp' : 'prog.c';
                    const srcPath = path.join(tmpDir, srcName);
                    // Ensure source ends with a newline to avoid compiler warnings like "no newline at end of file"
                    const srcContents = code.endsWith('\n') ? code : (code + '\n');
                    fs.writeFileSync(srcPath, srcContents, 'utf8');

                    // Output binary name
                    let exePath = path.join(tmpDir, 'prog');
                    if (process.platform === 'win32') exePath += '.exe';

                    const compiler = isCpp ? 'g++' : 'gcc';
                    let compileArgs;
                    if (process.platform === 'win32') {
                        compileArgs = [srcPath, '-o', exePath, '-Wall', '-Wextra'];
                    } else {
                        compileArgs = isCpp
                            ? [srcPath, '-o', exePath, '-std=c++17', '-Wall', '-Wextra']
                            : [srcPath, '-o', exePath, '-std=c11', '-Wall', '-Wextra'];
                    }

                    // Compile (attempt with fallback strategies if the compiler errors)
                    const { spawnSync } = require('child_process');

                    function tryCompile(tool, args) {
                        try {
                            const r = spawnSync(tool, args, { cwd: tmpDir, encoding: 'utf8', windowsHide: true });
                            return { code: r.status, cout: r.stdout || '', cerr: r.stderr || '', error: r.error };
                        } catch (e) {
                            return { code: 1, cout: '', cerr: '', error: e };
                        }
                    }

                    // First attempt: primary compiler with compileArgs
                    let compileResult = tryCompile(compiler, compileArgs);

                    // If compiler crashed with internal error or unrecognized option, try fallbacks
                    const stderrText = (compileResult.cerr || '').toLowerCase();
                    const needFallback = compileResult.code !== 0 && (
                        stderrText.includes('internal error') ||
                        stderrText.includes('unrecognized command line option') ||
                        compileResult.error
                    );

                    if (needFallback) {
                        // Try clang/clang++ if available
                        const altCompiler = isCpp ? 'clang++' : 'clang';
                        const altCheck = tryCompile(altCompiler, ['--version']);
                        if (altCheck.code === 0) {
                            // Try compiling with clang
                            const altArgs = compileArgs.slice();
                            // clang understands -std flags on most setups; keep args
                            compileResult = tryCompile(altCompiler, altArgs);
                        } else {
                            // As a last resort on Windows, retry without -std flags
                            if (process.platform === 'win32') {
                                const fallbackArgs = compileArgs.filter(a => !a.startsWith('-std'));
                                compileResult = tryCompile(compiler, fallbackArgs);
                            }
                        }
                    }

                    if (compileResult.code !== 0) {
                        // If compile still failed, surface full stderr/stdout and give actionable advice
                        const fullErr = (compileResult.cerr || compileResult.cout || String(compileResult.error || ''));
                        const advice = `Your C/C++ compiler failed with an internal error or unsupported option. This commonly indicates an outdated or broken toolchain (especially on Windows MinGW).\nRecommended fixes:\n - Install MSYS2/mingw-w64 or use WSL and a modern gcc/g++.\n - Or install clang and try again.\n\nFull compiler output:\n${fullErr}`;
                        return res.status(500).json({ error: `Compilation failed: ${fullErr}`, advice });
                    }

                    // If compilation succeeded but there are warnings, include them in the response as 'warnings'
                    const warnings = (compileResult.cerr || '').trim();
                    const hasWarnings = warnings.length > 0;

                    // Run the binary with timeout
                    const runResult = await new Promise((resolve) => {
                        const proc = spawn(exePath, [], { cwd: tmpDir });
                        let out = '';
                        let err = '';
                        const timer = setTimeout(() => {
                            try { proc.kill('SIGKILL'); } catch (e) {}
                            resolve({ timedOut: true, out, err: err + '\nTimed out' });
                        }, 5000);

                        proc.stdout.on('data', (d) => { out += d.toString(); });
                        proc.stderr.on('data', (d) => { err += d.toString(); });
                        proc.on('close', (code) => {
                            clearTimeout(timer);
                            resolve({ timedOut: false, code, out, err });
                        });
                        proc.on('error', (e) => {
                            clearTimeout(timer);
                            resolve({ timedOut: false, code: 1, out: '', err: e.message });
                        });
                    });

                    if (runResult.timedOut) {
                        return res.status(500).json({ error: runResult.err });
                    }

                    if (runResult.code !== 0) {
                        return res.status(500).json({ error: runResult.err || 'Execution failed' });
                    }

                    // Include compiler warnings if any
                    if (hasWarnings) {
                        return res.json({ output: runResult.out, warnings });
                    }

                    return res.json({ output: runResult.out });
                } catch (err) {
                    return res.status(500).json({ error: err.message });
                } finally {
                    // Cleanup
                    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
                }
            }

            // Other languages (Java, etc.) not supported yet
            return res.status(400).json({ error: `Execution for language '${language}' is not supported on this server. You can still request code correction.` });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/analyze-line', async (req, res) => {
    const { line } = req.body;
    
    try {
        const pythonProcess = spawn('python', [
            path.join(__dirname, 'python', 'analyze_line.py'),
            line
        ]);

        let result = '';
        let error = '';

        pythonProcess.stdout.on('data', (data) => {
            result += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            error += data.toString();
        });

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                return res.status(500).json({ error: error || 'Analysis failed' });
            }
            res.json(JSON.parse(result));
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/save-transcript', async (req, res) => {
    const { transcript } = req.body;
    
    try {
        const pythonProcess = spawn('python', [
            path.join(__dirname, 'python', 'save_transcript.py'),
            transcript
        ]);

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                return res.status(500).json({ error: 'Failed to save transcript' });
            }
            res.json({ message: 'Transcript saved successfully!' });
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/train-model', async (req, res) => {
    try {
        const pythonProcess = spawn('python', [
            path.join(__dirname, 'python', 'train_model.py')
        ]);

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                return res.status(500).json({ error: 'Training failed' });
            }
            res.json({ message: 'AI model trained successfully!' });
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

// Clean up child python process on exit
function shutdown() {
    if (pyServerProcess) {
        try {
            pyServerProcess.kill();
        } catch (e) {
            console.error('Error killing python server process:', e);
        }
    }
    process.exit();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('exit', () => {
    if (pyServerProcess) {
        try { pyServerProcess.kill(); } catch (e) { }
    }
});

// Forward '/correct' requests to the Python Flask server (started above)
app.post('/correct', async (req, res) => {
    try {
        const postData = JSON.stringify(req.body);

        const options = {
            hostname: '127.0.0.1',
            port: 5000,
            path: '/correct',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const proxyReq = http.request(options, (proxyRes) => {
            let data = '';
            proxyRes.on('data', (chunk) => { data += chunk; });
            proxyRes.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    res.status(proxyRes.statusCode).json(parsed);
                } catch (e) {
                    res.status(500).json({ success: false, error: 'Invalid JSON from python server', raw: data });
                }
            });
        });

        proxyReq.on('error', (e) => {
            console.error('Error forwarding to python server:', e.message);
            res.status(500).json({ success: false, error: e.message });
        });

        proxyReq.write(postData);
        proxyReq.end();
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});