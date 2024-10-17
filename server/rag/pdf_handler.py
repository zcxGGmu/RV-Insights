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

    def get_pdf_files(self):
        pdf_files = []
        for file in os.listdir(self.dir):
            if file.lower().endswith('.pdf'):
                pdf_files.append(os.path.join(self.dir, file))
        logging.info(f"Found {len(pdf_files)} PDF files.")
        return pdf_files

    def load_pdf_content(self, pdf_path):
        pdf_loader = PyMuPDFLoader(pdf_path)
        docs = pdf_loader.load()
        logging.info(f"Loading content from {pdf_path}.")
        return docs

    def split_text(self, docs):
        # Break the text into smaller sections
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size = self.chunksize,
            chunk_overlap = self.overlap,
            length_function = len,
            add_start_index = True,
        )
        docs = text_splitter.split_documents(docs)
        logging.info("Split text into smaller chunks with RecurseCharacterTextSplitter.")
        return docs

    def insert_docs2db(self, docs, insert_function, batch_size=None):
        """
        Insert documents into the specified database and display the progress.
        - params
            - docs: List of documents to be inserted.
            - insert_function: The function used to insert the documents.
            - batch_size: The size of each batch for insertion.
        """
        if batch_size is None:
            batch_size = self.batch_num
        logging.info(f"Inserting {len(docs)} docs.")

        start_time = time.time()
        total_docs_inserted = 0

        total_batches = (len(docs) + batch_size - 1 ) // batch_size
        with tqdm(total=total_batches, desc="Inserting batches", unit="batch") as pbar:
            for i in range(0, len(docs), batch_size):
                batch = docs[i:i + batch_size]
                insert_function(batch)
                total_docs_inserted += len(batch)
                # current tpm
                elapsed_time = time.time() - start_time
                if elapsed_time > 0:
                    tpm = (total_docs_inserted / elapsed_time) * 60
                    pbar.set_postfix({"TPM": f"{tpm: .2f}"})
                pbar.update(1)

    def insert_2vectordb(self, docs):


    def insert_2elasticsearch(self, docs):


    def handle_pdfs_group(self, pdf_files_group):


    def handle_pdfs(self):
