import os
import logging
import time

from tqdm import tqdm
from langchain_community.documents_loaders import PyMuPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from rag.vector_db import VectorDB
from rag.elasticsearch_db import TraditionDB
from utils.logger import LoggerManager

logger = LoggerManager().logger

class PDFHandler:
    def __init__(self, dir, db_type='vector', **kwargs):
        """
        init pdf_handler
        db_type: `vector/es`
        """
        self.dir = dir
        self.db_type = db_type
        self.file_num_group = kwargs.get('file_num_group', 20)
        self.batch_num = kwargs.get('batch_num', 6)
        self.chunksize = kwargs.get('chunksize', 500)
        self.overlap = kwargs.get('overlap', 100)
        logger.info(f"""
                    Initialize PDF File Importer:  
                    Configuration Parameters:  
                    - File path for import: {self.directory}  
                    - Number of files processed per group: {self.file_group_num}  
                    - Number of samples processed per batch: {self.batch_num}  
                    - Text chunk size: {self.chunksize}  
                    - Text chunk overlap size: {self.overlap}  
                    """)
        # Initialize the corresponding client based on the database type
        if db_type == 'vector':
            self.vector_db = kwargs.get('vector_db')
            self.es_client = None
            logger.info(f'The target database for import is: VectorDB')
        elif db_type == 'es':
            self.vector_db = None
            self.es_client = kwargs.get('es_client')
            logger.info(f'The target database for import is: ESDB')
        else:
            raise ValueError("db_type must be either `vector/es`!")

    def load_pdf_files(self):


    def load_pdf_content(self):


    def split_text(self, docs):


    def insert_docs2db(self, docs, insert_function, batch_size=None):


    def insert_2vectordb(self, docs):


    def insert_2elasticsearch(self, docs):


    def handle_pdfs_group(self, pdf_files_group):


    def handle_pdfs(self):
