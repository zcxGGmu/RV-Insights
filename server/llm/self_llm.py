#!/usr/bin/env python
# -*- encoding: utf-8 -*-
'''
在 LangChain LLM 基础上封装的项目类，统一了 GPT、文心、讯飞、智谱多种 API 调用
'''

from langchain.llms.base import LLM
from typing import Dict, Any, Mapping
from pydantic import Field

class Self_LLM(LLM):
    url: str = None
    model_name: str = "gpt-3.5-turbo"
    request_timeout: float = None
    temperature: float = 0.1
    api_key: str = None
    model_kwargs: Dict[str, Any] = Field(default_factory=dict)

    @property
    def _default_params(self) -> Dict[str, Any]:
        normal_params = {
            "temperature": self.temperature,
            "request_timeout": self.request_timeout,
        }
        return {**normal_params}

    @property
    def _identifying_params(self) -> Mapping[str, Any]:
        """Get the identifying parameters."""
        return {**{"model_name": self.model_name}, **self._default_params}
