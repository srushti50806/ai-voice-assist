// Initialize CodeMirror
let editor = CodeMirror(document.getElementById('editor'), {
    mode: 'python',
    theme: 'monokai',
    lineNumbers: true,
    autoCloseBrackets: true,
    indentUnit: 4,
    tabSize: 4,
    value: `# Welcome to AI Voice Code Debugger!
# Try this sample code or write your own

def calculate_factorial(n):
    if n < 0:
        return "Error: Negative number"
    elif n == 0:
        return 1
    else:
        result = 1
        for i in range(1, n + 1):
            result *= i
        return result

# Test the function
number = 5
factorial = calculate_factorial(number)
print(f"Factorial of {number} is {factorial}")`
});

// Global variables
let isListening = false;
let recognition = null;
let debugMode = false;
let currentLine = 0;
let variables = {};

// Initialize Speech Recognition
function initializeSpeechRecognition() {
    if ('webkitSpeechRecognition' in window) {
        recognition = new webkitSpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;

        recognition.onstart = () => {
            updateVoiceStatus('Listening...');
        };

        recognition.onresult = (event) => {
            const transcript = Array.from(event.results)
                .map(result => result[0].transcript)
                .join('');

            updateTranscript(transcript, event.results[0].isFinal);

            if (event.results[0].isFinal) {
                processVoiceCommand(transcript);
            }
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            stopListening();
        };

        recognition.onend = () => {
            if (isListening) {
                recognition.start();
            }
        };
    }
}

// Voice control functions
function toggleVoice() {
    if (!recognition) {
        initializeSpeechRecognition();
    }

    if (isListening) {
        stopListening();
    } else {
        startListening();
    }
}

function startListening() {
    isListening = true;
    recognition.start();
    document.getElementById('voiceButton').classList.add('scale-110', 'ring-4', 'ring-primary-light', 'ring-opacity-50');
    updateVoiceStatus('Listening...');
}

function stopListening() {
    isListening = false;
    recognition.stop();
    document.getElementById('voiceButton').classList.remove('scale-110', 'ring-4', 'ring-primary-light', 'ring-opacity-50');
    updateVoiceStatus('Click to start listening');
}

function updateVoiceStatus(status) {
    document.getElementById('voiceStatus').textContent = status;
}

function updateTranscript(text, isFinal) {
    const transcript = document.getElementById('transcript');
    const p = document.createElement('p');
    p.className = isFinal ? 'text-gray-800' : 'text-gray-400 italic';
    p.textContent = text;
    
    if (!isFinal) {
        const temp = transcript.querySelector('.temp');
        if (temp) temp.remove();
        p.classList.add('temp');
    }
    
    transcript.insertBefore(p, transcript.firstChild);
}

// Process voice commands
async function processVoiceCommand(command) {
    const lowerCommand = command.toLowerCase();

    if (lowerCommand.includes('correct this code')) {
        // Always get the latest selected language from the dropdown
        try {
            const languageSelect = document.getElementById('languageSelect');
            const language = languageSelect && languageSelect.value ? languageSelect.value : 'python';
            const response = await fetch('/correct', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ code: editor.getValue(), language })
            });
            const data = await response.json();
            if (data.success && data.corrected_code) {
                editor.setValue(data.corrected_code);
                updateAIResponse('Code corrected!');
            } else {
                updateAIResponse('No corrections made or error occurred.');
            }
        } catch (err) {
            updateAIResponse('Error correcting code: ' + err.message);
        }
        return;
    }

    // ...existing code...
}

// Code execution functions
async function runCode() {
    const code = editor.getValue();
    const language = document.getElementById('languageSelect').value;
    
    updateOutput('Executing code...\n');
    
    try {
        const response = await fetch('/api/execute', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ code, language })
        });

        const data = await response.json();
        
        if (data.error) {
            updateOutput('Error: ' + data.error);
        } else {
            updateOutput(data.output);
        }
    } catch (err) {
        updateOutput('Error executing code: ' + err.message);
    }
}

function debugCode() {
    debugMode = true;
    currentLine = 0;
    
    updateOutput('Debug mode started. Use voice commands or click "Step" to proceed.');
    updateAIResponse('Debug mode activated! I\'ll help you understand each step.');
    
    // Highlight the first line
    editor.addLineClass(0, 'background', 'bg-yellow-100');
}

function stepCode() {
    if (!debugMode) {
        updateOutput('Please start debug mode first.');
        return;
    }

    // Remove previous line highlight
    editor.removeLineClass(currentLine, 'background', 'bg-yellow-100');
    
    currentLine++;
    const totalLines = editor.lineCount();

    if (currentLine < totalLines) {
        // Add highlight to current line
        editor.addLineClass(currentLine, 'background', 'bg-yellow-100');
        
        // Get line content and analyze it
        const line = editor.getLine(currentLine);
        analyzeCurrentLine(line);
    } else {
        debugMode = false;
        updateOutput('Debug session completed.');
        updateAIResponse('Debug session finished! Let me know if you have any questions.');
    }
}

async function analyzeCurrentLine(line) {
    try {
        const response = await fetch('/api/analyze-line', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ line })
        });

        const data = await response.json();
        
        if (data.error) {
            updateAIResponse('Error analyzing line: ' + data.error);
        } else {
            updateAIResponse(data.analysis);
            if (data.variables) {
                updateVariables(data.variables);
            }
        }
    } catch (err) {
        console.error('Error analyzing line:', err);
        updateAIResponse('Error analyzing current line');
    }
}

// UI update functions
function updateOutput(text) {
    const output = document.getElementById('output');
    output.textContent = text;
    output.scrollTop = output.scrollHeight;
}

function updateAIResponse(text) {
    document.getElementById('aiResponse').textContent = text;
}

function updateVariables(vars) {
    const varsContainer = document.getElementById('variables');
    varsContainer.innerHTML = Object.entries(vars)
        .map(([name, value]) => `
            <div class="bg-gray-50 p-2 rounded">
                <span class="font-mono text-primary-dark">${name}:</span>
                <span class="font-mono text-gray-600">${value}</span>
            </div>
        `)
        .join('');
}

// Training functions
document.getElementById('save-transcript-btn').addEventListener('click', async () => {
    const transcript = document.getElementById('transcript').innerText;
    
    try {
        const response = await fetch('/api/save-transcript', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ transcript })
        });

        const data = await response.json();
        updateOutput(data.message);
    } catch (err) {
        console.error('Error saving transcript:', err);
        updateOutput('Error saving transcript');
    }
});

document.getElementById('train-ai-btn').addEventListener('click', async () => {
    try {
        const response = await fetch('/api/train-model', {
            method: 'POST'
        });

        const data = await response.json();
        updateOutput(data.message);
    } catch (err) {
        console.error('Error training model:', err);
        updateOutput('Error training AI model');
    }
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeSpeechRecognition();
});