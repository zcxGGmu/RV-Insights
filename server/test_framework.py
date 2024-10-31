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

def test_rag():
    from rag.rag import RagManager
    from rag.vector_db import ChromaDB
    from rag.retrievers import SimpleRetrieverWrapper

    llm, chat, embed = settings.LLM, settings.CHAT, settings.EMBED
    # Chroma
    db_config = {
        "chroma_server_type": "http",
        "host": "localhost",
        "port": 8000,
        "persist_path": "chroma_db",
        "collection_name": "langchaintest",
    }
    # RAG
    rag_manager = RagManager(vector_db_class = ChromaDB,
                             db_config = db_config,
                             llm = llm, embed = embed,
                             retriever_cls = SimpleRetrieverWrapper)
    # example
    query = "先介绍一下 Ssctr 指令集，该特性对虚拟化的影响？"
    result = rag_manager.get_results(query)
    print(result)

def test_agent():
    # llm, chat, embed = settings.LLM, settings.CHAT, settings.EMBED
    from rv_agent import RVAgent
    agent = RVAgent()
    query = "请介绍一下RISC-V NACL扩展，并以列表形式呈现其关联的所有SBI函数."
    agent.handle_query(query)

if __name__ == "__main__":
    test_import_vector_db()
    test_rag()
    test_agent()
