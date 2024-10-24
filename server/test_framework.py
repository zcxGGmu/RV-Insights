import os
import datetime
import settings

from utils.logger import LoggerManager

logger = LoggerManager().logger

# Test the main process of importing a PDF into a vector database
def test_import_vector_db():
    from rag.pdf_handler import PDFHandler
    from rag.vector_db import ChromaDB
    
    llm, chat, embed = settings.LLM, settings.CHAT, settings.EMBED
    dir = "./dataset/pdf"
    db_config = {
        "chroma_server_type": "local",
        "host": settings.CHROMA_HOST,
        "port": settings.CHROMA_PORT,
        "persist_path": "chroma_db",
        "collection_name": settings.CHROMA_COLLECTION_NAME,
    }
    vector_db = ChromaDB(**db_config, embed)
    pdf_handler = PDFHandler(dir, vector_db, None, embed)

    pdf_handler.handle_pdfs()

if __name__ == "__main__":
    test_import_vector_db()
