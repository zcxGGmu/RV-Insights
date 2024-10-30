<div align="center">
  <img alt="RV-Insights Logo" width="170" height="170" src="./imgs/logo.webp">
  <h1>RV-Insights</h1>
  <span> English | <a href="README_zh.md">中文</a></span>
</div>




## ⚡ Project Overview

`RV-Insights` is an intelligent Q&A system tailored for the RISC-V domain. This system is designed to handle:

- RISC-V-specific knowledge Q&A
- Local, private knowledge base Q&A
- Real-time internet search Q&A.

Additionally, the system integrates a comprehensive RAG (retrieval-augmented generation) evaluation plan and process, supports Docker containerized deployment, and offers a flexible and efficient application deployment solution.

The project aims to build an expert-level agent specializing in RISC-V, with expertise in "everything related to RISC-V":

* **Real-time Dynamics in the RISC-V Domain**
  * Up-to-date information on RISC-V progress globally, focusing primarily on software and hardware design updates, including:
      - Developments in RISC-V RVI/RISE conferences
      - RISC-V ISA/NON-ISA advancements
  * Updates on open-source software and hardware projects related to RISC-V, such as:
      - `linux/qemu/opensbi-riscv` mailing lists and upstream contributions
  * Support for adding additional RISC-V projects of interest

* **RISC-V Expert Knowledge Q&A**
  * **Instruction Set Architecture (ISA) Explanation**: Assisting users in understanding the RISC-V ISA, offering guidance on instruction usage, functionality, and best practices.
  * **Technical Issue Resolution**: Answering development-related technical questions across applications, system software, compilers, assembly, hardware design, and more.
  * **Error Troubleshooting and Debugging**: Helping users analyze compilation errors, runtime issues, and debugging problems, providing possible solutions and reference materials.
  * **Development Environment Setup Guide**: Guiding users on setting up a RISC-V development environment, including configuration for Linux, QEMU, KVM, and more.

* **Access to Private RISC-V Resources**
  * Ingestion and refinement of private resources, such as Markdown and PDF documents, enabling a streamlined workflow for building and processing content from scratch.


### Technical Architecture
This project utilizes a frontend-backend separated design. The backend is entirely developed in Python, while the frontend is built with the modern Vue 3 framework.

### Key Features
- **Comprehensive Functionality**: Includes general domain knowledge Q&A with large models, local private knowledge base Q&A, real-time internet search Q&A, AI Agents Q&A, and large model recommendation systems.
- **Data Preprocessing**: Processes from zero to one and refines millions of public Wiki corpora, Markdown, PDF, and other types of private corpora.
- **User Permission Management**: Implements fine-grained user access control to efficiently ensure data security and privacy.
- **Flexible Integration with Base Large Models**: Supports integration with mainstream online and open-source large models, ensuring system adaptability and forward-thinking capabilities.
- **Database Integration**: Integrates relational databases and vector databases to optimize data access efficiency and query response times.
- **Efficient and Complete RAG Evaluation System**: Features a complete RAG evaluation pipeline that provides robust support for model assessment and optimization. See 👉 [FlashRAG](https://github.com/RUC-NLPIR/FlashRAG) for reference.
- **Docker Container Deployment**: Supports Docker container deployment, simplifying the deployment process and enhancing the system's portability and maintainability.

## 👀 System Demonstration

Video coming soon.............

## 💧 Feature Highlights

### 一、User Module
`RV-Insights` provides a comprehensive user registration and login mechanism, ensuring system security and a personalized experience for each user. The main features of this module include:

1. **User Registration**: Allows new users to create accounts. Once registered, users can access the system through the front-end login interface.
2. **User Validation**: Conducts preliminary user validation at the front-end. Illegitimate users are prevented from accessing the intelligent Q&A system, ensuring system security.
3. **Session Management and Knowledge Base Access**: Logged-in users can access system-predefined sessions and their personally created sessions. Additionally, users can utilize their own knowledge bases for Q&A, with strict limitations on each user’s data access to ensure the privacy of personal data.

#### Core Logic Flow:
  <div align="center">
  <img src="https://muyu001.oss-cn-beijing.aliyuncs.com/img/01_user_verify_clean.png" width="1200"/>
  </div>


### 二、Model Integration
`RV-Insights` is compatible with a variety of high-performance open-source large models and online large model APIs as base models. This system version primarily uses ChatGLM3-6b, glm-4-9b-chat, and the online GLM-4 API interface. It allows users to flexibly integrate other models according to their actual needs, supporting mainstream models such as OpenAI GPT, Qwen2, as well as integration frameworks like Vllm and Ollama.

#### Underlying Technical Support:
We have utilized the 👉 [FastChat](https://github.com/lm-sys/FastChat) open-source project framework to deploy models, optimizing support for the glm4-9b-chat model. Although the FastChat framework was initially not compatible with glm4-9b-chat, we have manually fixed issues including streaming output and self-ask self-answer loops. Now, the glm4-9b-chat model is fully functional and stable. 

#### Extensibility:
To facilitate users to extend or test new models, we provide detailed code examples. Through these examples, users can understand how to integrate new models into the system, further enhancing the system’s functionality and flexibility.

### 三、Core Q&A Functionality Description
#### 3.1 General Knowledge Q&A

The general knowledge Q&A feature of the `RV-Insights` fully utilizes the native conversational capabilities of large models. This function is based directly on large models and is integrated with the LangChain application framework to create a unified large model conversation interface. It enhances the memory capabilities of large model sessions by reading historical dialogue records from the MySQL database for specified users and dialogue windows in real time. 

##### Feature Highlights:

- **Multi-turn Dialogue Support**: Users can engage in continuous dialogue, with the system maintaining the context of the conversation to enhance coherence.
- **Session History Memory**: By remembering users' historical dialogues, the system can provide more personalized and accurate responses, greatly enhancing user experience.

##### Core Logic Flow:

  <div align="center">
  <img src="https://muyu001.oss-cn-beijing.aliyuncs.com/img/02_gen_qa_clean.png" width="1200"/>
  </div>

#### 3.2 Local Private Knowledge Base Q&A

Building upon the general knowledge Q&A process, we have introduced functionality for loading and retrieving from local knowledge bases using RAG technology with large models to enhance the quality of Q&A. This feature allows integration of large models with private data, effectively addressing limitations in large model knowledge. 

##### Technical Implementation:
We utilize Faiss for storing vector indexes, providing efficient retrieval capabilities for the system. The system is equipped with knowledge bases including millions of public Wiki corpora and private corpora (in PDF format), enhancing data breadth and depth. 

##### Feature Highlights:
- **Multi-turn Dialogue Support**: Maintains coherence across multiple interactions.
- **Historical Memory Functionality**: Enhances conversation personalization and relevance through historical session records.
- **System Prompt Role**: Introduces a system prompt role to guide user interactions, providing a more humane interactive experience.
- **Real-time Faiss Vector Data Retrieval**: Utilizes Faiss vector database for fast and efficient data retrieval, optimizing answer accuracy.

##### Core Logic Flow:

  <div align="center">
  <img src="https://muyu001.oss-cn-beijing.aliyuncs.com/img/03_rag_qa_clean.png" width="1200"/>
  </div>

#### 3.3 Online Real-Time Retrieval + Private Knowledge Base Q&A
This feature integrates real-time online retrieval, a very mainstream large model application in AI search today. We ensure the efficiency and accuracy of information retrieval through more detailed process handling, which performs well even under domestic network conditions. 

##### Implementation Process:

1. **Information Retrieval via 👉 [Serper API](https://serper.dev/) Google Search**: Utilizes the search capabilities built with the Serper API to retrieve webpage information in real-time based on the user’s query.
2. **Preliminary Re-ranking**: The system filters initial search results, selecting the top N webpages most relevant to the query.
3. **Information Indexing**: Rule-based extraction of the selected webpage content is performed, followed by indexing and storage in the Milvus vector database, preparing for subsequent retrieval operations.
4. **Vector Retrieval**: Executes retrieval within the Milvus vector database to quickly find information chunks (Chunks) most relevant to the user’s query.
5. **Answer Generation**: Integrates the retrieved information chunks into a complete prompt, from which it generates precise answers to meet the user's query needs.

##### Core Logic Flow:

  <div align="center">
  <img src="https://muyu001.oss-cn-beijing.aliyuncs.com/img/04_real_network_clean1.png" width="1200"/>
  </div>


## 🚀 Development

```shell
git clone git@github.com:zcxGGmu/RV-Chatchat.git
cd ./RV-Chatchat

conda create --name rv-chat python=3.10
conda activate rv-chat
pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
```

