import chromadb
from langchain_chroma import Chroma
from langchain_community.vectorstores.milvus import Milvus

class VectorDB:
    def add_with_langchain(self, docs):
        """
        Add documents to the vector database using LangChain.
        """
        raise NotImplementedError("Subclasses should implement this method")

    def get_store(self):
        """
        Get the vector database store.
        """
        raise NotImplementedError("Subclasses should implement this method")
