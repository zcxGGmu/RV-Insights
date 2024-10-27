#!/usr/bin/env python
# -*- encoding: utf-8 -*-

"""
get llm completion
"""

import openai
import json
import requests
import _thread as thread
import base64
import datetime
import hashlib
import hmac
import os
import queue
import ssl
import zhipuai
import websocket

from dotenv import load_dotenv, find_dotenv
from urllib.parse import urlparse
from urllib.parse import urlencode
from datetime import datetime
from time import mktime
from wsgiref.handlers import format_date_time
from langchain.utils import get_from_dict_or_env

# entry
def get_completion(prompt: str, model: str, temperature = 0.1,
                   api_key = None, secret_key = None, access_token = None,
                   appid = None, api_secret = None, max_tokens = 2048):
    """
    # secret_key, access_token：wenxin
    # appid, api_secret: spark
    """
    if model in ["gpt-3.5-turbo", "gpt-3.5-turbo-16k-0613", "gpt-3.5-turbo-0613", "gpt-4", "gpt-4-32k"]:
        return get_completion_gpt(prompt, model, temperature, api_key, max_tokens)
    elif model in ["ERNIE-Bot", "ERNIE-Bot-4", "ERNIE-Bot-turbo"]:
        return get_completion_wenxin(prompt, model, temperature, api_key, secret_key)
    elif model in ["Spark-1.5", "Spark-2.0"]:
        return get_completion_spark(prompt, model, temperature, api_key, appid, api_secret, max_tokens)
    elif model in ["chatglm_pro", "chatglm_std", "chatglm_lite"]:
        return get_completion_glm(prompt, model, temperature, api_key, max_tokens)
    else:
        return "incorrect model name !!!"

# utils
## get llm api_{key/secret}
def parse_llm_api_key(model: str, env_file: dict=None):
    if env_file == None:
        _ = load_dotenv(find_dotenv())
        env_file = os.environ

    if model == "openai":
        return env_file["OPENAI_API_KEY"]
    elif model == "wenxin":
        return env_file["wenxin_api_key"], env_file["wenxin_secret_key"]
    elif model == "spark":
        return env_file["spark_api_key"], env_file["spark_appid"], env_file["spark_api_secret"]
    elif model == "zhipuai":
        return get_from_dict_or_env(env_file, "zhipuai_api_key", "ZHIPUAI_API_KEY")
    else:
        raise ValueError(f'model{model} not support !!!')

## wenxin: get access_token by api_{key/secret}
def get_access_token(api_key, secret_key):
    


# openai
def get_completion_gpt(prompt: str, model: str, temperature: float,
                       api_key: str, max_tokens: int):
    if api_key == None:
        api_key = parse_llm_api_key("openai")
    openai.api_key = api_key

    messages = [{"role": "user", "content": prompt}]
    response = openai.ChatCompletion.create(
        model = model,
        messages = messages,
        temperature = temperature,
        max_tokens = max_tokens,
    )
    return response.choices[0].message["content"]

# baidu wenxin
