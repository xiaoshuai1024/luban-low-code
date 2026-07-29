"""三家模型真实 API 冒烟测试。

默认不在 CI/普通 pytest 跑（标记 @pytest.mark.smoke）。
需配真实 key：

    MODEL_PROVIDER=glm GLM_API_KEY=<key> uv run pytest tests/smoke/test_smoke.py -m smoke -k glm
    MODEL_PROVIDER=deepseek DEEPSEEK_API_KEY=<key> ... -k deepseek
    MODEL_PROVIDER=tongyi QWEN_API_KEY=<key> ... -k tongyi

验证：三家均能 chat(结构化) + stream(流式) 跑通，产合法对象。
"""
