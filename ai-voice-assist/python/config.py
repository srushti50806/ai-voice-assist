import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class Config:
    """Configuration class to manage environment variables"""
    
    # API Keys
    GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
    
    # Server Configuration
    PORT = int(os.getenv('PORT', 3000))
    
    # Environment
    DEBUG_MODE = os.getenv('DEBUG_MODE', 'true').lower() == 'true'
    
    # Paths
    PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    @classmethod
    def validate(cls):
        """Validate required environment variables"""
        required_vars = ['GEMINI_API_KEY']
        missing_vars = [var for var in required_vars if not getattr(cls, var)]
        
        if missing_vars:
            raise EnvironmentError(
                f"Missing required environment variables: {', '.join(missing_vars)}\n"
                f"Please check your .env file or environment variables."
            )