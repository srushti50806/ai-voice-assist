
from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import subprocess
import os
from analyze_code import analyze_code

app = Flask(__name__)
CORS(app)

# Base directory for python scripts (this file's directory)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def _abs_path(*parts):
    return os.path.normpath(os.path.join(BASE_DIR, *parts))

@app.route('/correct', methods=['POST'])
def correct():
    try:
        data = request.get_json()
        code = data.get('code', '')
        language = data.get('language', 'python').lower()
        app.logger.debug(f"Received /correct request for language: {language}")
        if not code:
            return jsonify({'success': False, 'error': 'No code provided'})
        if language == 'javascript' or language == 'js':
            # Call correct_js.js using Node.js (absolute path)
            js_path = _abs_path('..', 'js', 'correct_js.js')
            process = subprocess.Popen(
                ['node', js_path],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                cwd=BASE_DIR
            )
        elif language == 'c':
            c_path = _abs_path('..', 'c', 'correct_c.py')
            process = subprocess.Popen(
                ['python', c_path],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                cwd=BASE_DIR
            )
        elif language == 'cpp' or language == 'c++':
            cpp_path = _abs_path('..', 'cpp', 'correct_cpp.py')
            process = subprocess.Popen(
                ['python', cpp_path],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                cwd=BASE_DIR
            )
        elif language == 'java':
            java_path = _abs_path('..', 'java', 'correct_java.py')
            process = subprocess.Popen(
                ['python', java_path],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                cwd=BASE_DIR
            )
        else:
            # Default: Python
            py_path = _abs_path('correct_code.py')
            process = subprocess.Popen(
                ['python', py_path],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                cwd=BASE_DIR
            )
        stdout, stderr = process.communicate(input=code.encode())
        if stderr:
            return jsonify({'success': False, 'error': stderr.decode()}), 500
        result = json.loads(stdout.decode())
        return jsonify({'success': True, 'corrected_code': result.get('corrected_code', code), 'message': result.get('message', ''), 'error': result.get('error', '')})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/analyze', methods=['POST'])
def analyze():
    try:
        data = request.get_json()
        code = data.get('code', '')
        
        if not code:
            return jsonify({'success': False, 'error': 'No code provided'})
        
        analysis_result = analyze_code(code)
        return analysis_result, 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    app.run(port=5000)