#!/usr/bin/env python3
"""小程序审查扫描脚本"""
import os, re

BASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src')

def find_files(exts):
    results = []
    for root, dirs, files in os.walk(BASE):
        dirs[:] = [d for d in dirs if d != 'node_modules']
        for f in files:
            if any(f.endswith(e) for e in exts):
                results.append(os.path.join(root, f))
    return results

def grep(pattern, files):
    results = []
    for fp in files:
        try:
            with open(fp, encoding='utf-8') as fh:
                for i, line in enumerate(fh, 1):
                    if re.search(pattern, line):
                        results.append({'file': fp, 'line': i, 'text': line.strip()[:120]})
        except: pass
    return results

def read_all(files):
    content = ''
    for fp in files:
        try:
            with open(fp, encoding='utf-8') as fh:
                content += fh.read() + '\n'
        except: pass
    return content

ts_files = find_files(['.ts', '.tsx'])
tsx_files = find_files(['.tsx'])
all_tsx = read_all(tsx_files)

print("=" * 60)
print("1. 安全红线: 硬编码IP")
print("=" * 60)
for m in grep(r'43\.139\.194\.155', ts_files):
    print(f"  {m['file']}:{m['line']} {m['text']}")

print("\n" + "=" * 60)
print("2. localStorage keys 读写一致性")
print("=" * 60)
sets = set()
gets = set()
for fp in ts_files:
    try:
        with open(fp, encoding='utf-8') as fh:
            c = fh.read()
        sets.update(re.findall(r"setStorageSync\(['\"](\w+)['\"]", c))
        gets.update(re.findall(r"getStorageSync\(['\"](\w+)['\"]", c))
    except: pass

print(f"  写入keys: {sorted(sets)}")
print(f"  读取keys: {sorted(gets)}")
w_only = sets - gets
r_only = gets - sets
if w_only: print(f"  WARNING 只写不读: {w_only}")
if r_only: print(f"  WARNING 只读不写: {r_only}")
if not w_only and not r_only: print("  读写一致 OK")

print("\n" + "=" * 60)
print("3. onClick/onInput 函数引用检查")
print("=" * 60)
onclick_fns = set()
patterns = [
    r"onClick=\{\(\)\s*=>\s*(\w+)\(",
    r"onClick=\{(\w+)\}",
    r"onClick=\"(\w+)\(",
    r"onClick=\{\(\)\s*=>\s*\{?\s*(\w+)\(",
    r"onConfirm=\{(\w+)\}",
    r"onInput=\{\([^)]*\)\s*=>\s*(\w+)\(",
    r"onInput=\{\([^)]*\)\s*=>\s*\{?\s*(\w+)\(",
    r"onBlur=\{(\w+)\}",
]
exclude = {'console', 'void', 'setState', 'setKeyword', 'setForm', 
           'setRegForm', 'setShowRegModal', 'setShowEditor', 'setShowPicker',
           'setActiveTab', 'setAddrType', 'setProxyAddress', 'setSeedUrl',
           'setShowSeedInput', 'setShowKeyManage', 'setCounterOrderId',
           'setCounterNewPrice', 'setCounterNote', 'setShowCounter',
           'setShowShipModal', 'setShipOrderId', 'setShipTrackingNo',
           'setShipCarrier', 'setShowArbitrate', 'setArbDisputeId',
           'setArbVerdict', 'setArbRefund', 'setOrderFilter',
           'setOrderDateFrom', 'setOrderDateTo', 'setDetailOrderId',
           'setEditing', 'setLocalResults', 'setSearched',
           'setMyProducts', 'setShippingAddresses', 'setReceivingAddresses',
           'setShowPublish', 'setProductImages',
           'setShowLocationPicker', 'setShowAddrEdit', 'setEditAddr',
           'setAddrProvince', 'setAddrCity', 'setAddrDistrict',
           'setShowUnitCustom', 'setUnitPickerIdx', 'setEditingSku',
           'setTheme', 'setReceiveAddrs', 'setShippingAddrs',
           'setRegSubmitting', 'setRegistered', 'setRegisterId',
           'setShowRegModal'}

for pat in patterns:
    for m in re.finditer(pat, all_tsx):
        fn = m.group(1)
        if fn not in exclude:
            onclick_fns.add(fn)

undefined = []
for fn in sorted(onclick_fns):
    # 检查函数定义: const fn = | function fn | fn: ( | fn( | {fn}
    if not re.search(r'\b' + re.escape(fn) + r'\s*[=(:{\n]', all_tsx):
        undefined.append(fn)

if undefined:
    print(f"  UNDEFINED ({len(undefined)}):")
    for fn in undefined: print(f"    - {fn}")
else:
    print(f"  All {len(onclick_fns)} functions defined OK")
    print(f"  Functions: {sorted(onclick_fns)}")

print("\n" + "=" * 60)
print("4. 空值兜底检查")
print("=" * 60)
# 检查 orders/disputes/reviews 等数组是否在使用前有 nil/undefined 兜底
for check in [r'\.orders\b(?!\?)', r'\.disputes\b(?!\?)', r'\.reviews\b(?!\?)', r'\.cart\b(?!\?)']:
    hits = grep(check, tsx_files)
    if hits:
        # 检查附近是否有 ?. 或 || [] 兜底
        print(f"  Pattern '{check}': {len(hits)} 处引用")

print("\n" + "=" * 60)
print("5. try/catch 空 catch 扫描")
print("=" * 60)
empty_catches = 0
for fp in ts_files:
    try:
        with open(fp, encoding='utf-8') as fh:
            content = fh.read()
        # 找 catch {} 或 catch { } 模式
        catches = re.findall(r'catch\s*\{?\s*\}?\s*$', content, re.MULTILINE)
        empty_catches += len(catches)
    except: pass
print(f"  空catch块: {empty_catches} 处")

print("\n✅ 扫描完成")
