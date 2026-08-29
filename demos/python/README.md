# LeoUpload Python Demo (FastAPI)

LeoUpload 上传协议的 Python 参考实现，端口 **3003**。

## 运行

```bash
pip install -r requirements.txt
uvicorn main:app --reload --port 3003
```

## 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/upload/init` | POST | 初始化上传会话，返回已上传分片（支持断点续传/秒传指纹去重） |
| `/api/upload/chunk` | POST | 上传单个分片（multipart），服务端 MD5 校验 |
| `/api/upload/progress/:id` | GET | 查询已上传分片列表 |
| `/api/upload/complete/:id` | POST | 合并分片，返回文件 URL 和整文件 MD5 |
| `/api/upload/:id` | DELETE | 取消上传并清理分片 |

特性：分片 MD5 校验（不匹配返回 409）、同指纹会话复用（断点续传）、合并后整文件校验、过期会话每小时自动清理、`/uploads` 静态托管合并后的文件。
