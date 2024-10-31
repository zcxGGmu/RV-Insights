import datetime
import settings
import operator

from langgraph.prebuilt import create_react_agent
from langgraph.checkpoint.memory import MemorySaver
from langchain.tools.retriever import create_retriever_tool
from langchain_community.utilities import SQLDatabase
from langchain_community.agent_toolkits import SQLDatabaseToolkit
from langchain_core.prompts import SystemMessagePromptTemplate
from langchain_core.prompts import HumanMessagePromptTemplate
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.agents import AgentAction, AgentFinish
from langchain_core.messages import BaseMessage
from typing import TypedDict, Annotated, List, Union
from utils.logger import LoggerManager
from rag.vector_db import ChromaDB
from rag.vector_db import MilvusDB
from rag.rag import RagManager

logger = LoggerManager().logger

def get_datetime() -> str:
    now = datetime.datetime.now()
    date = now.strftime("%Y-%m-%d %H:%M:%S")
    return date

class AgentState(TypedDict):
    input: str
    chat_history: list[BaseMessage]
    agent_outcome: Union[AgentAction, AgentFinish, None]
    intermediate_steps: Annotated[list[tuple[AgentAction, str]], operator.add]

class RVAgent:
    def __init__(self,
                 llm = settings.LLM,
                 chat = settings.CHAT,
                 embed = settings.EMBED,
                 vector_db_type = 'chroma'):
        self.llm = llm
        self.chat = chat
        self.embed = embed
        self.tools = []
        # select vector_db
        if vector_db_type.lower() == 'chroma':
            db_config = {
                "chroma_server_type": settings.CHROMA_SERVER_TYPE,
                "host": settings.CHROMA_HOST,
                "port": settings.CHROMA_PORT,
                "persist_path": settings.CHROMA_PERSIST_DB_PATH,
                "collection_name": settings.CHROMA_COLLECTION_NAME,
            }
            self.rag = RagManager(vector_db_class = ChromaDB,
                                  db_config = db_config,
                                  llm = self.llm,
                                  embed = self.embed)
        else:
            db_config = {
                "milvus_server_type": settings.MILVUS_SERVER_TYPE,
                "host": settings.MILVUS_HOST,
                "port": settings.MILVUS_PORT,
                "collection_name": settings.MILVUS_COLLECTION_NAME,
            }
            self.rag = RagManager(vector_db_class = MilvusDB,
                                  db_config = db_config,
                                  llm = self.llm,
                                  embed = self.embed)
        self.agent_executor = self.init_agent()
        logger.info(f'初始化框架: RVAgent')

    @staticmethod
    def create_sys_prompt():
        sys_prompt = """你是一位面向RISC-V领域的专家，尽可能的回答用户关于RISC-V的一切问题。
            为了更好的回答问题，你可以使用工具进行多轮的尝试。
                                                
            # 关于retriever_tool工具的使用：
            1、你需要结合对检索出来的上下文进行回答问题。
            2、你可以使用检索工具来查找相关的资料，以便回答用户的问题。
            3、检索的词语最好使用命名实体，例如：公司名称、人名、产品名称等。
                                     
            # 关于你的思考和行动过程，请按照如下格式：
            问题：你必须回答的输入问题
            思考：你应该总是考虑该怎么做
            行动：你应该采取的行动，应该是以下工具之一：{tool_names}
            行动输入：行动的输入
            观察：行动的结果
            ... (这个思考/行动/行动输入/观察可以重复N次)
            最终答案：原始输入问题的最终答案

            # 关于最终答案：
            1、如果你不知道答案，就说你不知道。
            2、请对最终答案总结，给出不超过三句话的简洁回答。
            
            Begin!
                            
            """
        return sys_prompt

    def init_rag_tools(self):
        retriever = self.rag.retriever_instance.create_retriever()
        retriever_tool = create_retriever_tool(
            retriever = retriever,
            name = "rag_search",
            description = """按照用户的问题搜索相关的资料，
                对于RISC-V ISA/SBI、指令集、特性相关的知识，
                you must use this tool!"""
        )
        return retriever_tool

    def init_agent(self):
        retriever_tool = self.init_rag_tools()
        sys_prompt = self.create_sys_prompt()
        agent_executor = create_react_agent(
            self.chat,
            tools = [get_datetime, retriever_tool],
            state_modifier = sys_prompt,
            checkpointer = MemorySaver(),
        )
        return agent_executor
    
    def handle_query(self, query):
        config = {"configurable": {"thread_id": "thread-1"}}
        try:
            events = self.agent_executor.stream(
                {"messages": [("user", query)]},
                config = config,
                stream_mode = "values",
            )
            result_list = []
            # print messages of stream events
            for event in events:
                logger.info(event["messages"][-1].pretty_print())
                result_list.append(event["messages"][-1].content)
            result_final = event["messages"][-1].content if result_list else None
            # print entire chat log
            logger.info(f'查询过程:')
            for res in result_list:
                logger.info(f'[agent]: {res}')
            logger.info(f"最终结果: {result_final}")
        except Exception as e:
            logger.error(f"处理查询时错误: {e}")
            raise e
    
    # langgraph agent
    # def create_agent(self):
    
