import logging
import pprint
from threading import Lock

class LoggerManager:
    _instance = None
    _lock = Lock()

    def __new__(cls, *args, **kwargs):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._initialized = False
        return cls._instance

    def __init__(self, name='LoggerManager',
                 log_file='server.log', level=logging.INFO):
        if self._initialized:
            return
        self.logger = logging.getLogger(name)
        self.logger.setLevel(level)
        self.log_file = log_file
        self._setup_handlers()
        self._initialized = True

    def _setup_handlers(self):
        if not self.logger.hasHandlers():
            # set file handler
            file_handler = logging.FileHandler(self.log_file, encoding='utf-8')
            file_handler.setLevel(self.logger.level)
            file_formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
            file_handler.setFormatter(file_formatter)
            self.logger.addHandler(file_handler)
            # set console handler
            console_handler = logging.StreamHandler()
            console_handler.setLevel(self.logger.level)
            console_formatter = PrettyConsoleFormatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
            console_handler.setFormatter(console_formatter)
            self.logger.addHandler(console_handler)

    def set_log_file(self, file):
        self.log_file = file
        self._update_file_handler()
    
    def set_level(self, level):
        self.logger.setLevel(level)
        for handler in self.logger.handlers:
            handler.setLevel(level)

    def _update_file_handler(self):
        # remove old file_handler
        for handler in self.logger.handlers:
            if isinstance(handler, logging.FileHandler):
                self.logger.removeHandler(handler)
        # add new file_handler
        file_handler = logging.FileHandler(self.log_file, encoding='utf-8')
        file_handler.setLevel(self.logger.level)
        file_formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
        file_handler.setFormatter(file_formatter)
        self.logger.addHandler(file_handler)

class PrettyConsoleFormatter(logging.Formatter):
    def format(self, record):
        if isinstance(record.msg, dict):
            record.msg = pprint.pformat(record.msg)
        return super().format(record)
