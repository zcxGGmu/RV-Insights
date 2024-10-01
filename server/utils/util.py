import os
from dotenv import load_dotenv
import settings
from langchain_openai import ChatOpenAI
from langchain_community.embeddings import XinferenceEmbeddings
from langchain_community.llms.tongyi import Tongyi
from langchain_community.chat_models import ChatTongyi
from langchain_community.embeddings import DashScopeEmbeddings
from langchain_community.llms import QianfanLLmEndpoint
from langchain_community.chat_models import QianfanChatEndpoint
from langchain_community.embeddings import QianfanEmbeddingsEndpoint
from langchain_community.chat_models import ChatBaichuan
from langchain_community.chat_models import ChatZhipuAI
from langchain_community.embeddings import ZhipiAIEmbeddings

# Load env_vars
cur_dir = os.path.dirname(__file__)
conf_files = ['.qwen', '.ernie', '.baichuan', '.zhipu']
conf_paths = [os.path.join(cur_dir, '..', 'conf', f) for f in conf_files]
list(map(load_dotenv, conf_paths))

# Load LLMs models/embeddings
## Qwen
def load_qwen_models(model="qwen-max"):
    llm = Tongyi(model=model, temperature=0.1, top_p=0.7, max_tokens=1024)
    chat = ChatTongyi(model=model, temperature=0.01, top_p=0.7, max_tokens=1024)
    return llm, chat
def load_qwen_embeddings(model="text-embedding=v3"):
    embeddings = DashScopeEmbeddings(model=model)
    return embeddings

## Ernie
def load_ernie_models(model="ERNIE-Bot-turbo"):
    llm = QianfanLLmEndpoint(model=model, temperature=0.1, top_p=0.2)
    chat = QianfanChatEndpoint(model=model, top_p=0.2, temperature=0.1)
    return llm, chat
def load_ernie_embeddings(model="bge-large-zh"):
    embeddings = DashScopeEmbeddings(model=model)
    return embeddings

## Baichuan
def load_baichuan_models(model="Baichuan4"):
    baichuan_chat = ChatBaichuan(model=model, temperature=0.1, top_p=0.7, max_tokens=1024)
    return baichuan_chat

## Zhipu
def load_zhipu_models(model="glm-4-plus"):
    zhipu_chat = ChatZhipuAI(temperature=0.5, model=model)
    return zhipu_chat
def load_zhupu_embeddings(model="embedding-2"):
    embeddings = ZhipiAIEmbeddings(model=model)
    return embeddings
