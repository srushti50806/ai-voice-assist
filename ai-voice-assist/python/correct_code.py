import sys
import json
import ast
import re

def correct_code(code):
    """
    Attempts to correct common Python errors in the code.
    This is a simple rule-based corrector for demonstration.
    """
    lines = code.split('\n')
    corrected_lines = []
    for line in lines:
        # Example fix: Replace division by zero
        if re.search(r'/\s*0', line):
            line = re.sub(r'/\s*0', '/ 1  # Fixed: avoid division by zero', line)
        # Example fix: Replace math.sqrt(-1) with math.sqrt(1)
        if 'math.sqrt(-1)' in line:
            line = line.replace('math.sqrt(-1)', 'math.sqrt(1)  # Fixed: sqrt of negative')
        corrected_lines.append(line)
    corrected_code = '\n'.join(corrected_lines)
    return corrected_code

if __name__ == "__main__":
    if len(sys.argv) >= 2:
        code = sys.argv[1]
    else:
        # Read code from stdin
        code = sys.stdin.read()
    print(json.dumps({"corrected_code": correct_code(code)}))
