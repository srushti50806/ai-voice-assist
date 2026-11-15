import subprocess
import sys
import tempfile
import os
import json

def correct_c_code(code):
    # Write code to a temp file
    with tempfile.NamedTemporaryFile(delete=False, suffix='.c', mode='w', encoding='utf-8') as f:
        f.write(code)
        temp_path = f.name
    # Run gcc with -fsyntax-only to check for errors
    result = subprocess.run(['gcc', '-fsyntax-only', temp_path], capture_output=True, text=True)
    os.unlink(temp_path)
    if result.returncode == 0:
        return {'corrected_code': code, 'message': 'No syntax errors found.'}
    else:
        return {'error': result.stderr}

if __name__ == "__main__":
    code = sys.stdin.read()
    output = correct_c_code(code)
    print(json.dumps(output))
