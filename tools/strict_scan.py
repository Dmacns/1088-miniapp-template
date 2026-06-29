#!/usr/bin/env python3
import os, re

base = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src')
issues = []
file_count = 0

for root, dirs, files in os.walk(base):
    dirs[:] = [d for d in dirs if d != 'node_modules']
    for f in files:
        if not f.endswith(('.tsx', '.ts')):
            continue
        file_count += 1
        fp = os.path.join(root, f)
        try:
            with open(fp, encoding='utf-8') as fh:
                content = fh.read()
        except:
            continue

        rel = os.path.relpath(fp, base).replace('\\', '/')

        # 1. 硬编码IP（非配置用途）
        if '43.139.194.155' in content:
            # 检查是否在配置常量中
            if "DEFAULT_SEED" not in content or "seedUrl" not in content:
                issues.append(f"[{rel}] 硬编码IP")

        # 2. localStorage keys 单文件不一致
        set_keys = set(re.findall(r"setStorageSync\(['\"](\w+)['\"]", content))
        get_keys = set(re.findall(r"getStorageSync\(['\"](\w+)['\"]", content))
        only_set = set_keys - get_keys
        only_get = get_keys - set_keys
        if only_set:
            issues.append(f"[{rel}] setStorageSync only: {only_set}")
        if only_get:
            issues.append(f"[{rel}] getStorageSync only: {only_get}")

        # 3. 潜在的未定义变量引用（在setState回调中引用外部变量但该变量在作用域外定义）
        # 检测: setState((prev) => { ... order?.xxx ... }) 但 order 在 setState 外部定义
        # 这个比较复杂，手动审查

        # 4. useCallback 空依赖但使用了state变量
        for m in re.finditer(r"useCallback\(\([^)]*\)\s*=>\s*\{(.*?)\},\s*\[\s*\]\s*\)", content, re.DOTALL):
            body = m.group(1)
            # 检查是否引用了state.xxx
            state_refs = re.findall(r'state\.(\w+)', body)
            if state_refs:
                issues.append(f"[{rel}] useCallback([])引用state.{state_refs}")

print(f"Scan: {file_count} files")
print(f"Issues: {len(issues)}")
for i in issues:
    print(f"  {i}")
