"""
Rate limiter インスタンスの共有モジュール。
main.py・各ルーターで import して使用する。
循環インポートを防ぐため独立モジュールとして定義。
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
