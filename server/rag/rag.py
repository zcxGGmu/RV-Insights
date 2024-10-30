import logging
import settings

from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langchain_core.runnables.base import RunnableLambda
from langchain_core.output_parsers import StrOutputParser
from langchain_community.document_transformers import LongContextReorder
from .retrievers import SimpleRetrieverWrapper
from .vector_db import ChromaDB
from utils.logger import LoggerManager

logger = LoggerManager().logger

class RagManager:
    def __init__(self,
                 vector_db_class = ChromaDB,
                 db_config = None,
                 llm = None, embed = None,
                 retriever_cls = SimpleRetrieverWrapper, **kwargs):
        self.llm = llm
        self.embed = embed
        logger.info(f'初始化llm大模型: {self.llm}')
        logger.info(f'初始化embed模型: {self.embed}')

        if db_config is None:
            db_config = {
                "chroma_sever_type": settings.CHROMA_SERVER_TYPE,
                "host": settings.CHROMA_HOST,
                "port": settings.CHROMA_PORT,
                "persist_path": settings.CHROMA_PERSIST_DB_PATH,
                "collection_name": settings.CHROMA_COLLECTION_NAME
            }
            logger.info(f'初始化向量数据库配置: {db_config}')
        self.vector_db = vector_db_class(**db_config, embed=self.embed)
        self.store = self.vector_db.get_store()

        self.retriever_instance = retriever_cls(self.store, self.llm, **kwargs)
        logger.info(f'使用的检索器类: {retriever_cls.__name__}')
    
    def get_chain(self, retriever):
        prompt = ChatPromptTemplate.from_messages([
            ("human", """You are an assistant for question-answering tasks. Use the following pieces 
          of retrieved context to answer the question. 
          If you don't know the answer, just say that you don't know. 
          Use three sentences maximum and keep the answer concise.
          Question: {question} 
          Context: {context} 
          Answer:""")
        ])
        format_docs_runnable = RunnableLambda(self.format_docs)

        rag_chain = (
            {
                "context": retriever | format_docs_runnable,
                "question": RunnablePassthrough()
            }
            | prompt
            | self.llm
            | StrOutputParser()
        )
        return rag_chain

    def format_docs(self, docs):
        content_retrieved = "\n\n".join(doc.page_content for doc in docs)
        logger.info(f"检索到的资料为: \n{content_retrieved}")

        try:
            files_retrieved = "\n".join([doc.metadata["source"] for doc in docs])
            logger.info(f"资料文件如下: \n{files_retrieved}")
        except Exception as e:
            logger.info(f'处理查询时没有找到source字段: {e}')

        logger.info(f"检索到的文件个数: {len(docs)}")
        return content_retrieved

    def get_results(self, question):
        retriever = self.retriever_instance.create_retriever()
        rag_chain = self.get_chain(retriever)
        try:
            result = rag_chain.invoke(input=question)
            logger.info(f"RAG查询结果: {result}")
            return result
        except Exception as e:
            logger.error(f"查询时发生错误: {e}")
            return f'{question} 查询时发生错误: {e}'
