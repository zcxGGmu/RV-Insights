import chromadb
from langchain_chroma import Chroma
from langchain_community.vectorstores.milvus import Milvus
from utils.logger import LoggerManager

logger = LoggerManager().logger

class VectorDB:
    def add_with_langchain(self, docs):
        """
        Add documents to the vector database using LangChain.
        """
        raise NotImplementedError("Subclasses should implement this method")

    def get_store(self):
        """
        Get the vector database instance.
        """
        raise NotImplementedError("Subclasses should implement this method")

class ChromaDB(VectorDB):
    def __init__(self,
                chroma_server_type="local",
                host="localhost", port=8000,
                persist_path="chroma_db",
                collection_name="langchain",
                embed=None):
        self.host = host
        self.port = port
        self.path = persist_path
        self.embed = embed

        if chroma_server_type == "http":
            client = chromadb.HttpClient(host=host, port=port)
            self.store = Chroma(collection_name = collection_name,
                                embedding_function = self.embed,
                                client=client)
            logger.info(f'ChromaDB initialized with HTTP server at {host}:{port}')
        elif chroma_server_type == "local":
            self.store = Chroma(collection_name = collection_name,
                                embedding_function = self.embed,
                                persist_directory=self.path)
            logger.info(f'ChromaDB initialized with local server, persist path: {self.path}')

        if self.store is None:
            raise ValueError("ChromaDB initialization failed")

        logger.info(f'ChromaDB Collection name: {collection_name}')
        logger.info(f'ChromaDB Embedding model: {self.embed}')

    def add_with_langchain(self, docs):
        self.store.add_documents(documents=docs)

    def get_store(self):
        return self.store

class MilvusDB(VectorDB):
    def __init__(self,
                 milvus_server_type="http",
                 host="localhost", port=19530,
                 collection_name="LangChainCollection",
                 embed=None):
        self.host = host
        self.port = port
        self.collection_name = collection_name
        self.embed = embed

        if milvus_server_type == "http":
            self.store = Milvus(
                collection_name=self.collection_name,
                connection_args={"uri": f"http://{host}:{port}"},
                embedding_function=self.embed,
                auto_id=True)
        else:
            # TODO: Milvus local server
            self.store = Milvus(
                collection_name=self.collection_name,
                connection_args={"uri": f"tcp://{host}:{port}"},
                embedding_function=self.embed,
                auto_id=True)

    def add_with_langchain(self, docs):
        self.store.add_documents(documents=docs)

    def get_store(self):
        return self.store
