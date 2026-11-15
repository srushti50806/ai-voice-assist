import sys
import json
import ast

def analyze_line(line):
    result = {
        'analysis': '',
        'variables': {}
    }

    try:
        # Parse the line
        tree = ast.parse(line)
        
        # Analyze the AST
        for node in ast.walk(tree):
            if isinstance(node, ast.Assign):
                # Variable assignment
                for target in node.targets:
                    if isinstance(target, ast.Name):
                        result['variables'][target.id] = 'undefined'  # Actual value would be determined at runtime
                        result['analysis'] = f"Assigning value to variable '{target.id}'"
            
            elif isinstance(node, ast.If):
                result['analysis'] = "Conditional statement (if/elif/else)"
            
            elif isinstance(node, ast.For):
                result['analysis'] = "For loop statement"
            
            elif isinstance(node, ast.While):
                result['analysis'] = "While loop statement"
            
            elif isinstance(node, ast.FunctionDef):
                result['analysis'] = f"Function definition: {node.name}"
            
            elif isinstance(node, ast.Return):
                result['analysis'] = "Return statement"
            
            elif isinstance(node, ast.Call):
                if isinstance(node.func, ast.Name):
                    result['analysis'] = f"Calling function: {node.func.id}"

    except SyntaxError:
        result['analysis'] = "Invalid Python syntax"
    except Exception as e:
        result['analysis'] = f"Error analyzing line: {str(e)}"

    return json.dumps(result)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No line provided"}))
        sys.exit(1)

    line = sys.argv[1]
    print(analyze_line(line))