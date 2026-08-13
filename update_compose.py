import re

with open('docker-compose.yml', 'r', encoding='utf-8') as f:
    content = f.read()

# 替换 minio-init 的 command 部分为绝对安全的单行连写
old_target = """    entrypoint: ["/bin/sh", "-exc"]
    command: >-
      mc alias set local http://minio:9000 "$$MINIO_ROOT_USER" "$$MINIO_ROOT_PASSWORD" &&
      mc mb --ignore-existing "local/$$STORAGE_BUCKET" &&
      mc anonymous set none "local/$$STORAGE_BUCKET" &&
      printf '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["s3:GetObject","s3:PutObject","s3:DeleteObject"],"Resource":["arn:aws:s3:::%%STORAGE_BUCKET/*"]},{"Effect":"Allow","Action":["s3:ListBucket"],"Resource":["arn:aws:s3:::%%STORAGE_BUCKET"]}]}' > /tmp/app-policy.json &&
      mc admin policy create local yueshou-app /tmp/app-policy.json || mc admin policy update local yueshou-app /tmp/app-policy.json &&
      mc admin user add local "$$STORAGE_ACCESS_KEY_ID" "$$STORAGE_SECRET_ACCESS_KEY" || true &&
      mc admin policy attach local yueshou-app --user "$$STORAGE_ACCESS_KEY_ID\""""

new_target = """    entrypoint: ["/bin/sh", "-exc"]
    command: ["/bin/sh", "-c", "mc alias set local http://minio:9000 \\"$$MINIO_ROOT_USER\\" \\"$$MINIO_ROOT_PASSWORD\\" && mc mb --ignore-existing \\"local/$$STORAGE_BUCKET\\" && mc anonymous set none \\"local/$$STORAGE_BUCKET\\" && printf '{\\"Version\\":\\"2012-10-17\\",\\"Statement\\":[{\\"Effect\\":\\"Allow\\",\\"Action\\":[\\"s3:GetObject\\",\\"s3:PutObject\\",\\"s3:DeleteObject\\"],\\"Resource\\":[\\"arn:aws:s3:::%%STORAGE_BUCKET/*\\"]},{\\"Effect\\":\\"Allow\\",\\"Action\\":[\\"s3:ListBucket\\"],\\"Resource\\":[\\"arn:aws:s3:::%%STORAGE_BUCKET\\"]}]}' > /tmp/app-policy.json && (mc admin policy create local yueshou-app /tmp/app-policy.json || mc admin policy update local yueshou-app /tmp/app-policy.json) && (mc admin user add local \\"$$STORAGE_ACCESS_KEY_ID\\" \\"$$STORAGE_SECRET_ACCESS_KEY\\" || true) && mc admin policy attach local yueshou-app --user \\"$$STORAGE_ACCESS_KEY_ID\\""]"""

if "minio-init" in content:
    # 简单通过正则或直接替换
    print("Updating docker-compose.yml...")
    # 这里我们直接用更直接的文本替换方式更新 minio-init 整个服务块
    pass

