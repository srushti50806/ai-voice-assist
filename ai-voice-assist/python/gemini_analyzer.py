import google.generativeai as genai
import json
from config import Config

# Validate environment variables
Config.validate()

# Configure Gemini API
genai.configure(api_key=Config.GEMINI_API_KEY)

class GeminiAnalyzer:
    def __init__(self):
        self.model = genai.GenerativeModel('gemini-pro')

    async def analyze_code(self, code, language):
        """Analyze code and provide detailed explanation"""
        prompt = f"""
        Analyze this {language} code and explain:
        1. What the code does
        2. How it works line by line
        3. Any potential improvements or best practices
        
        Code:
        {code}
        """
        
        response = await self.model.generate_content(prompt)
        return response.text

    async def analyze_error(self, error, code, language):
        """Analyze error and provide solutions"""
        prompt = f"""
        Analyze this error in {language} code and provide:
        1. What caused the error
        2. How to fix it
        3. Best practices to avoid similar errors
        
        Error:
        {error}
        
        Code:
        {code}
        """
        
        response = await self.model.generate_content(prompt)
        return response.text

    async def process_voice_command(self, transcript, code, language):
        """Process voice command and provide contextual response"""
        prompt = f"""
        Given this voice command and code context, provide a helpful response:
        
        Voice Command: {transcript}
        Language: {language}
        Code:
        {code}
        
        Provide:
        1. Direct response to the user's question/command
        2. Any relevant code explanations
        3. Suggested next steps
        """
        
        response = await self.model.generate_content(prompt)
        return response.text

    async def explain_line(self, line, context, variables):
        """Explain a specific line of code with context"""
        prompt = f"""
        Explain this line of code in detail:
        
        Line: {line}
        
        Context:
        {context}
        
        Current Variables:
        {json.dumps(variables, indent=2)}
        
        Provide:
        1. What this line does
        2. How it affects program state
        3. Any relevant variable changes
        """
        
        response = await self.model.generate_content(prompt)
        return response.text