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

# helpers
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
    url = f"https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id={api_key}&client_secret={secret_key}"
    # POST access
    payload = json.dumps("")
    headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
    response = requests.request("POST", url, headers=headers, data=payload)
    return response.json().get("access_token")

## spark use
answer = ""

class Ws_Param(object):
    def __init__(self, appid, api_key, api_secret, spark_url):
        self.appid = appid
        self.api_key = api_key
        self.api_secret = api_secret
        self.temperature = 0
        self.max_tokens = 2048
        self.spark_url = spark_url
        self.host = urlparse(spark_url).netloc
        self.path = urlparse(spark_url).path
    def create_url(self):
        # RFC1123
        now = datetime().now()
        date = format_date_time(mktime(now.timetuple()))
        # connect string
        signature_origin = "host: " + self.host + "\n"
        signature_origin += "date: " + date + "\n"
        signature_origin += "GET " + self.path + " HTTP/1.1"
        # hmac-sha256
        signature_sha = hmac.new(self.api_secret.encode('utf-8'),
                                 signature_origin.encode('utf-8'),
                                 digestmod=hashlib.sha256).digest()
        signature_sha_base64 = base64.b64encode(signature_sha).decode(encoding='utf-8')
        authorization_origin = f'api_key="{self.api_key}", algorithm="hmac-sha256", headers="host date request-line", signature="{signature_sha_base64}"'
        authorization = base64.b64encode(authorization_origin.encode('utf-8')).decode(encoding='utf-8')

        v = {
            "authorization": authorization,
            "date": date,
            "host": self.host
        }
        url = self.spark_url + '?' + urlencode(v)
        return url

def on_error(ws, error):
    print("### error: ", error)

def on_close(ws,one,two):
    print(" ")

def on_open(ws):
    thread.start_new_thread(run, (ws,))

def on_message(ws, message):
    # print(message)
    data = json.loads(message)
    code = data['header']['code']
    if code != 0:
        print(f'请求错误: {code}, {data}')
        ws.close()
    else:
        choices = data["payload"]["choices"]
        status = choices["status"]
        content = choices["text"][0]["content"]
        print(content,end ="")
        global answer
        answer += content
        # print(1)
        if status == 2:
            ws.close()

def gen_params(appid, domain, question, temperature, max_tokens):
    """
    通过appid和用户的提问来生成请参数
    """
    data = {
        "header": {
            "app_id": appid,
            "uid": "1234"
        },
        "parameter": {
            "chat": {
                "domain": domain,
                "random_threshold": 0.5,
                "max_tokens": max_tokens,
                "temperature" : temperature,
                "auditing": "default"
            }
        },
        "payload": {
            "message": {
                "text": question
            }
        }
    }
    return data

def run(ws, *args):
    data = json.dumps(gen_params(appid=ws.appid, domain= ws.domain,question=ws.question, temperature = ws.temperature, max_tokens = ws.max_tokens))
    ws.send(data)

def spark_main(appid, api_key, api_secret, spark_url,
               domain, question, temperature, max_tokens):
    output_queue = queue.Queue()
    def on_message(ws, message):
        data = json.loads(message)
        code = data['header']['code']
        if code != 0:
            print(f'请求错误: {code}, {data}')
            ws.close()
        else:
            choices = data["payload"]["choices"]
            status = choices["status"]
            content = choices["text"][0]["content"]
            output_queue.put(content)
            if status == 2:
                ws.close()

    wsParam = Ws_Param(appid, api_key, api_secret, spark_url)
    websocket.enableTrace(False)
    wsUrl = wsParam.create_url()
    ws = websocket.WebSocket(wsUrl, on_message=on_message, on_error=on_error,
                             on_close=on_close, on_open=on_open)
    ws.appid = appid
    ws.question = question
    ws.domain = domain
    ws.temperature = temperature
    ws.max_tokens = max_tokens
    ws.run_forever(sslopt={"cert_reqs": ssl.CERT_NONE})
    return ''.join([output_queue.get() for _ in range(output_queue.qsize())])

# wenxin
def get_completion_wenxin(prompt: str, model: str, temperature: float,
                          api_key: str, secret_key: str):
    if api_key == None or secret_key == None:
        api_key, secret_key = parse_llm_api_key("wenxin")
    access_token = get_access_token(api_key, secret_key)
    url = f"https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/eb-instant?access_token={access_token}"
    payload = json.dumps({
        "messages": [
            {
                "role": "user",
                "content": "{}".format(prompt)
            }
        ]
    })
    headers = {
        'Content-Type': 'application/json'
    }

    response = requests.request("POST", url, headers=headers, data=payload)
    js = json.load(response.text)
    return js["result"]

# spark
def get_completion_spark(prompt: str, model: str, temperature: float,
                         api_key: str, appid: str, api_secret: str,
                         max_tokens: int):
    if api_key == None or appid == None and api_secret == None:
        api_key, appid, api_secret = parse_llm_api_key("spark")

    # Spark-1.5/General-v2.0
    if model == "Spark-1.5":
        domain = "general"
        spark_url = "ws://spark-api.xf-yun.com/v1.1/chat"  # v1.5
    else:
        domain = "generalv2"   # v2.0
        spark_url = "ws://spark-api.xf-yun.com/v2.1/chat"

    question = [{"role":"user", "content":prompt}]
    response = spark_main(appid, api_key, api_secret, spark_url,
                          domain, question, temperature, max_tokens)
    return response

# zhipuai/GLM
def get_completion_glm(prompt: str, model: str, temperature: float,
                       api_key: str, max_tokens: int):
    if api_key == None:
        api_key = parse_llm_api_key("zhipuai")
    zhipuai.api_key = api_key

    response = zhipuai.model_api.invoke(
        model = model,
        prompt = [{"role":"user", "content":prompt}],
        temperature = temperature,
        max_tokens = max_tokens,
    )
    return response["data"]["choices"][0]["content"].strip('"').strip(" ")


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
