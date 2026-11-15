import subprocess
import json

def analyze_code(code):
    """
    Runs code analysis on the provided Python code.
    Returns line-by-line analysis and execution results.
    """
    analysis = []
    
    # Split code into lines
    lines = code.strip().split('\n')
    
    for line in lines:
        line = line.strip()
        if line and not line.startswith('#'):  # Skip empty lines and comments
            try:
                # Call analyze_line.py for each line
                process = subprocess.Popen(
                    ['python', 'analyze_line.py', line],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE
                )
                stdout, stderr = process.communicate()
                
                result = json.loads(stdout.decode())
                analysis.append({
                    'line': line,
                    'analysis': result.get('analysis', 'Unknown'),
                    'variables': result.get('variables', {})
                })
            except Exception as e:
                analysis.append({
                    'line': line,
                    'analysis': f'Error: {str(e)}',
                    'variables': {}
                })
    
    return json.dumps({
        'success': True,
        'analysis': analysis
    })

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print(json.dumps({
            'success': False,
            'error': 'No code provided'
        }))
        sys.exit(1)
    
    code = sys.argv[1]
    print(analyze_code(code))