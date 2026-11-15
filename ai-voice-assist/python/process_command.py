import sys
import json
import asyncio
from gemini_analyzer import GeminiAnalyzer
import os

# Download required NLTK data
nltk.download('punkt')
nltk.download('stopwords')
nltk.download('wordnet')

class CommandProcessor:
    def __init__(self):
        self.analyzer = GeminiAnalyzer()

    async def process_command(self, command, code):
        # Detect programming language
        language = self.detect_language(code)
        
        # Process the command using Gemini
        response = await self.analyzer.process_voice_command(command, code, language)
        
        # Determine action type
        action = self.determine_action(command.lower())
        
        result = {
            'action': action,
            'explanation': response,
            'suggestions': await self.generate_suggestions(action, code, language)
        }
        
        return json.dumps(result)

    def detect_language(self, code):
        # Simple language detection based on code characteristics
        if 'def ' in code or 'print(' in code:
            return 'Python'
        elif 'function ' in code or 'console.log(' in code:
            return 'JavaScript'
        elif 'public class ' in code:
            return 'Java'
        elif '#include' in code:
            return 'C/C++'
        return 'Unknown'

    def determine_action(self, command):
        if any(word in command for word in ['run', 'execute']):
            return 'run'
        elif any(word in command for word in ['debug', 'step']):
            return 'debug'
        elif any(word in command for word in ['explain', 'what', 'how']):
            return 'explain'
        elif any(word in command for word in ['fix', 'error', 'help']):
            return 'fix'
        return 'explain'  # Default action

    async def generate_suggestions(self, action, code, language):
        if action == 'fix':
            # Get error analysis from Gemini
            return await self.analyzer.analyze_error("", code, language)
        return ""

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Insufficient arguments"}))
        sys.exit(1)

    processor = CommandProcessor()
    command = sys.argv[1]
    code = sys.argv[2]
    
    # Run the async function using asyncio
    async def main():
        result = await processor.process_command(command, code)
        print(result)
    
    asyncio.run(main())