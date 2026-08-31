"""HTTP 响应相关的公共工具。

主要解决下载文件名含中文时的编码问题：HTTP 响应头只允许 latin-1 编码，
若把中文文件名直接写进 Content-Disposition，starlette 在 init_headers 阶段
会抛 UnicodeEncodeError: 'latin-1' codec can't encode characters。

按 RFC 6266 / RFC 5987 同时给出两种形式，兼容各类客户端：
  - filename="xxx"        ASCII 回退名，供不支持 filename* 的老客户端使用
  - filename*=UTF-8''xxx  百分号编码的真实文件名，现代浏览器优先采用
"""
import os
import re
from urllib.parse import quote


def content_disposition(filename: str, disposition: str = "attachment") -> str:
    """构造可安全写入 HTTP 头的 Content-Disposition 值。

    Args:
        filename: 原始文件名，允许含中文。
        disposition: attachment（下载）或 inline（内联展示）。

    Returns:
        形如 attachment; filename="_report.docx"; filename*=UTF-8''%E7%83%9F... 的字符串
    """
    # 非 ASCII 与特殊字符统一替换为下划线，作为回退名
    ascii_name = re.sub(r"[^A-Za-z0-9._\-]", "_", filename).strip("_")
    # 回退名被清空或只剩扩展名时补默认名，避免出现 filename=""
    if not ascii_name or ascii_name.startswith("."):
        ext = os.path.splitext(filename)[1] or ""
        ascii_name = f"download{ext}"
    return (
        f'{disposition}; filename="{ascii_name}"; '
        f"filename*=UTF-8''{quote(filename, safe='')}"
    )
