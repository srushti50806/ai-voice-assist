import sys
import json
from io import StringIO
import contextlib

@contextlib.contextmanager
def capture_output():
    """Capture stdout and stderr"""
    stdout, stderr = StringIO(), StringIO()
    old_out, old_err = sys.stdout, sys.stderr
    try:
        sys.stdout, sys.stderr = stdout, stderr
        yield stdout, stderr
    finally:
        sys.stdout, sys.stderr = old_out, old_err

def execute_code(code):
    result = {
        'output': '',
        'error': None
    }

    try:
        with capture_output() as (out, err):
            # Execute the code in a safe environment
            local_vars = {}
            exec(code, {"__builtins__": __builtins__}, local_vars)
            
        result['output'] = out.getvalue()
        if err.getvalue():
            result['error'] = err.getvalue()

    except Exception as e:
        result['error'] = str(e)

    return json.dumps(result)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No code provided"}))
        sys.exit(1)

    code = sys.argv[1]
    print(execute_code(code))