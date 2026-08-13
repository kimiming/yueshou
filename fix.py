with open("docker-compose.yml", "r", encoding="utf-8") as f:
    text = f.read()

# 检查并定位需要替换的旧块
old_block_part = "minio-init:"
if old_block_part in text:
    # 直接用更简单干净的单行数组形式重写 minio-init 服务
    # 这里我们直接替换整个 minio-init 服务的定义片段
    import re
    
    # 匹配整个 minio-init 块到下一个服务或文件结尾
    pattern = r'  minio-init:\n(    [^\n]*\n)+'
    
    new_minio_init = """  minio-init:
    image: minio/mc:RELEASE.2025-04-16T18-13-26Z
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER:?Set MINIO_ROOT_USER in .env.docker}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD:?Set MINIO_ROOT_PASSWORD in .env.docker}
      STORAGE_BUCKET: ${STORAGE_BUCKET:?Set STORAGE_BUCKET in .env.docker}
      STORAGE_ACCESS_KEY_ID: ${STORAGE_ACCESS_KEY_ID:?Set STORAGE_ACCESS_KEY_ID in .env.docker}
      STORAGE_SECRET_ACCESS_KEY: ${STORAGE_SECRET_ACCESS_KEY:?Set STORAGE_SECRET_ACCESS_KEY in .env.docker}
      NEXT_PUBLIC_SITE_URL: ${NEXT_PUBLIC_SITE_URL:?Set NEXT_PUBLIC_SITE_URL in .env.docker}
    depends_on:
      validate: { condition: service_completed_successfully }
      minio: { condition: service_healthy }
    networks: [private]
    restart: "no"
    logging: *default-logging
    deploy: *default-resources
    command: ["sh", "-c", "mc alias set local http://minio:9000 \"$MINIO_ROOT_USER\" \"$MINIO_ROOT_PASSWORD\" && mc mb --ignore-existing \"local/$STORAGE_BUCKET\" && mc anonymous set none \"local/$STORAGE_BUCKET\" && mc admin user add local \"$STORAGE_ACCESS_KEY_ID\" \"$STORAGE_SECRET_ACCESS_KEY\" || true"]
"""
    
    # 执行替换
    text_new = re.sub(r'  minio-init:\n(?:    [^\n]*\n)+?(?=  [a-z\-]+:|\Z)', new_minio_init, text, flags=re.MULTILINE)
    
    with open("docker-compose.yml", "w", encoding="utf-8") as f:
        f.write(text_new)
    print("Successfully updated docker-compose.yml using fix.py!")
else:
    print("Error: Could not find minio-init in docker-compose.yml")
