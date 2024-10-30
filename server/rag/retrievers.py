from langchain_core.callbacks import CallbackManagerForRetrieverRun
from langchain_core.retrievers import BaseRetriever
from langchain_core.documents import Document
from langchain.retrievers import EnsembleRetriever
from langchain.retrievers.multi_query import MultiQueryRetriever
from langchain.retrievers.contextual_compression import ContextualCompressionRetriever
from langchain.retrievers.document_compressors import LLMChainExtractor

from utils.logger import LoggerManager

logger = LoggerManager().logger

class SimpleRetrieverWrapper():
    def __init__(self, store, llm, **kwargs):
        self.store = store
        self.llm = llm
        logger.info(f'检索器所使用的Chat模型: {self.llm}')

    def create_retriever(self):
        logger.info(f'初始化自定义检索器...')
        retrievers = []
        weights = []

        chromadb_retriever = self.store.as_retriever()
        retrievers.append(chromadb_retriever)
        weights.append(0.5)

        #TODO: more retrievers support

        ensemble_retriever = EnsembleRetriever(retrievers=retrievers, weights=weights)
        return ensemble_retriever
         