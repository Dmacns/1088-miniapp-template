#!/usr/bin/env python3
"""1088.exe 大赛支持能力严格测试"""
import subprocess, json, sys, time

BASE = 'https://1088.dmacns.com'
OK, FAIL, TOTAL = 0, 0, 0

def ok(name, cond, detail=''):
    global OK, FAIL, TOTAL
    TOTAL += 1
    if cond: OK += 1
    else: FAIL += 1
    print(f"  {'✅' if cond else '❌'} {name} {detail}")

def curl(method, path, data=None, cookie=None):
    cmd = ['curl', '-sk', '-X', method, f'{BASE}{path}',
           '-H', 'Content-Type: application/json',
           '-w', '\n%{http_code}', '-o', '/tmp/resp.json']
    if data: cmd += ['-d', json.dumps(data)]
    if cookie: cmd += ['-b', '/tmp/1088_cookie', '-c', '/tmp/1088_cookie']
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
        out = res.stdout.strip()
        code = out.split('\n')[-1] if out else '000'
        body = '\n'.join(out.split('\n')[:-1]) if '\n' in out else ''
        try: js = json.loads(body) if body else {}
        except: js = {}
        return int(code), js
    except Exception as e:
        return 0, {'error': str(e)}

# ===== 1. 健康检查 =====
print('\n=== 1. 服务状态 ===')
code, js = curl('GET', '/api/health')
ok('1088在线', code == 200, f"v{js.get('version','?')} base={js.get('base_version','?')} tables={js.get('tables','?')}")

# ===== 2. 15个账户登录测试 =====
print('\n=== 2. 登录测试(15账户) ===')
users = []
for ent in ['a','b','c','d','e']:
    for role in ['oper','purc','sale']:
        code, js = curl('POST', '/api/auth/login',
                         {'username': f'{ent}_{role}', 'password': 'test123'})
        if code == 200 and js.get('ok'):
            users.append({'ent': ent, 'role': role, 'did': js.get('did', ''),
                          'name': js.get('company_name', '')})
ok('15账户登录', len(users) == 15, f'{len(users)}/15成功')

# ===== 3. 角色系统 =====
print('\n=== 3. 角色权限 ===')
# a_oper 不能下单
code, js = curl('POST', '/api/auth/login', {'username': 'a_oper', 'password': 'test123'})
code2, js2 = curl('POST', '/api/orders',
                  {'sku': 'test', 'qty': 1, 'price': 10, 'product_name': 'test', 'seller_did': 'did:user:a_sale'})
ok('operator无法下单', code2 != 200, f'HTTP {code2}')

# a_purc 可以下单
code, js = curl('POST', '/api/auth/login', {'username': 'a_purc', 'password': 'test123'})
code2, js2 = curl('POST', '/api/orders',
                  {'sku': 'test_sku', 'qty': 2, 'price': 50, 'product_name': '测试商品', 'seller_did': 'did:user:a_sale'})
ok('purchase_manager可下单', code2 == 200, f'HTTP {code2}')
order_id = js2.get('order_id', '')

# a_sale 可以接单
code, js = curl('POST', '/api/auth/login', {'username': 'a_sale', 'password': 'test123'})
code2, js2 = curl('POST', '/api/orders/accept', {'order_id': order_id})
ok('sales_manager可接单', code2 == 200, f'HTTP {code2}')

# ===== 4. 商品管理 =====
print('\n=== 4. 商品管理 ===')
code, js = curl('POST', '/api/auth/login', {'username': 'a_sale', 'password': 'test123'})
# 创建商品
code2, js2 = curl('POST', '/api/products', {'name': '1088大赛测试商品', 'price': 99, 'unit': '件', 'stock': 500, 'location': '烟台', 'description': '测试'})
ok('创建商品', code2 == 200, js2.get('sku','?')[:20] if 'sku' in js2 else js2.get('error','?'))
sku = js2.get('sku', '')

# 列表
code2, js2 = curl('GET', '/api/products')
ok('商品列表', code2 == 200 and isinstance(js2, list), f'{len(js2) if isinstance(js2, list) else 0}个')

# 删除
if sku:
    code2, js2 = curl('DELETE', '/api/products', {'sku': sku})
    ok('删除商品', code2 == 200, f'sku={sku[:20]}')

# ===== 5. 市场搜索+购物车+协商+争议+评价 =====
print('\n=== 5. 市场搜索 ===')
code, js = curl('POST', '/api/market', {'keyword': '烟台'})
ok('市场搜索', code == 200, f'{len(js) if isinstance(js, list) else "err"}条')

print('\n=== 6. 购物车 ===')
code2, js2 = curl('POST', '/api/cart', {'sku': 'FRUIT001', 'qty': 1, 'price': 5.8, 'name': '苹果', 'seller_did': 'did:user:a_sale'})
ok('加入购物车', code2 == 200, str(js2)[:50])
code2, js2 = curl('GET', '/api/cart')
ok('购物车列表', code2 == 200, f'{len(js2) if isinstance(js2, list) else 0}个')

print('\n=== 7. Dashboard ===')
code2, js2 = curl('GET', '/api/dashboard')
ok('Dashboard', code2 == 200, f'products={js2.get("products",0)} orders={js2.get("orders",0)}')

print('\n=== 8. 财务看板 ===')
code2, js2 = curl('GET', '/api/finance/overview')
ok('财务概览', code2 == 200, f'GMV={js2.get("gmv_total",0)}')

print('\n=== 9. 客户管理 ===')
code2, js2 = curl('POST', '/api/customers', {'name': '大赛测试客户', 'phone': '13800000000'})
ok('创建客户', code2 == 200, str(js2)[:50])
code2, js2 = curl('GET', '/api/customers')
ok('客户列表', code2 == 200, f'{len(js2) if isinstance(js2,list) else 0}个')

print('\n=== 10. 采购审核队列 ===')
code, js = curl('POST', '/api/auth/login', {'username': 'a_oper', 'password': 'test123'})
code2, js2 = curl('POST', '/api/purchase-queue', {'sku': 'test', 'qty': 1, 'price': 10, 'product_name': '测试采购', 'seller_did': 'did:user:a_sale'})
ok('提交采购申请', code2 == 200, str(js2)[:60])
code2, js2 = curl('GET', '/api/purchase-queue')
ok('采购队列', code2 == 200, f'{len(js2) if isinstance(js2,list) else 0}项')

print('\n=== 11. 操作日志 ===')
code2, js2 = curl('GET', '/api/audit-log')
ok('操作日志', code2 == 200, f'{len(js2) if isinstance(js2,list) else 0}条')

# ===== 结果 =====
print('\n' + '=' * 50)
print(f'1088大赛支持力测试: {OK}/{TOTAL} 通过, {FAIL} 失败')
if FAIL == 0: print('✅ 1088.exe 完全可以支持大赛')
else: print(f'⚠️ {FAIL}项需关注')
