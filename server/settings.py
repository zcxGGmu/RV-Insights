import os
from utils.util import load_qwen_models
from utils.util import load_baichuan_models
from utils.util import load_zhipu_models
from utils.util import load_ernie_models
from utils.util import load_qwen_embeddings
from utils.util import load_zhipu_embeddings
from utils.util import load_ernie_embeddings

""" 
# Alibaba Qwen Series Models
# The default model is qwen-max
#   Model usage - Input: 0.04/text_token (per thousand)
#   Model usage - Output: 0.12/text_token (per thousand)
# qwen-long model
#   Model usage - Input: 0.0005/text_token (per thousand)
#   Model usage - Output: 0.002/text_token (per thousand)
"""
LLM = load_qwen_models(model="qwen-max")[0]
CHAT = load_qwen_models(model="qwen-max")[1]
EMBED = load_qwen_embeddings()

"""
# Baidu ERNIE Bot Series Models
# Default Model: ERNIE-Bot-turbo
#   Free
# ERNIE-4.0-8K Model
#   Model usage - Input: ¥0.04/1000 tokens
#   Model usage - Output: ¥0.12/1000 tokens
# ERNIE-3.5-8K Model
#   Model usage - Input: ¥0.004/1000 tokens
#   Model usage - Output: ¥0.012/1000 tokens
"""
# LLM = load_ernie_models()[0]
# CHAT = load_ernie_models()[1]
# EMBED = load_ernie_embeddings()

"""
# Zhipu Dialogue Models
# Promotion: Register to receive 5 million tokens,
#            new customer exclusive offer - recharge ¥99 for 10 million tokens
# GLM-4-Plus Model
#   Price: ¥0.05/1000 tokens
# GLM-4-Air Model
#   Price: ¥0.001/1000 tokens
#   Batch API Pricing: ¥0.0005/1000 tokens
"""
# LLM = load_zhipu_models(model="glm-4-plus")
# CHAT = load_zhipu_models(model="glm-4-flash")
# EMBED = load_zhipu_embeddings(model="embedding-3")

"""
Chroma
"""
# 默认的ChromaDB的服务器类别
CHROMA_SERVER_TYPE = "http"
# 默认本地数据库的持久化目录
CHROMA_PERSIST_DB_PATH = "chroma_db"

CHROMA_HOST = os.getenv("CHROMA_HOST", "sy-direct.virtaicloud.com")
CHROMA_PORT = int(os.getenv("CHROMA_PORT", 41502))
CHROMA_COLLECTION_NAME = "langchain"

# 默认导入PDF时使用local方式导入
CHROMA_SERVER_TYPE_IMPORT = "local"

"""
Milvus
"""
MILVUS_SERVER_TYPE = "http"
MILVUS_HOST = "localhost"
MILVUS_PORT = 19530
MILVUS_COLLECTION_NAME = "langchain"

"""
ESDB
"""
