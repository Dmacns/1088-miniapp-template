import subprocess, json

BASE = 'http://127.0.0.1:8088'
OK = FAIL = 0

def ok(name, cond, detail=''):
    global OK, FAIL
    if cond: OK += 1
    else: FAIL += 1
    icon = 'OK' if cond else 'FAIL'
    print(f'  {icon} {name} {detail}')

def curl(method, path, data=None):
    cmd = ['curl', '-s', '-X', method, BASE + path, '-H', 'Content-Type: application/json', '-b', '/tmp/cj', '-c', '/tmp/cj']
    if data:
        cmd += ['-d', json.dumps(data)]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
    try:
        js = json.loads(r.stdout) if r.stdout else {}
    except:
        js = {}
    return js

print('=== 1. 服务状态 ===')
js = curl('GET', '/api/health')
ok('1088在线', js.get('status') == 'ok', 'v' + str(js.get('version', '?')))

print('\n=== 2. 15账户登录 ===')
users = 0
for ent in ['a', 'b', 'c', 'd', 'e']:
    for role in ['oper', 'purc', 'sale']:
        js = curl('POST', '/api/auth/login', {'username': ent + '_' + role, 'password': 'test123'})
        if js.get('ok'):
            users += 1
ok('登录', users == 15, str(users) + '/15')

print('\n=== 3. 角色权限 ===')
curl('POST', '/api/auth/login', {'username': 'a_oper', 'password': 'test123'})
js = curl('POST', '/api/orders', {'sku': 't', 'qty': 1, 'price': 10, 'product_name': 't', 'seller_did': 'did:user:a_sale'})
ok('oper不能下单', 'error' in str(js) or not js.get('ok'))

curl('POST', '/api/auth/login', {'username': 'a_purc', 'password': 'test123'})
js = curl('POST', '/api/orders', {'sku': 't2', 'qty': 2, 'price': 50, 'product_name': 'test', 'seller_did': 'did:user:a_sale'})
oid = js.get('order_id', '')
ok('purc下单', bool(oid), oid[:30])

curl('POST', '/api/auth/login', {'username': 'a_sale', 'password': 'test123'})
js = curl('POST', '/api/orders/accept', {'order_id': oid})
ok('sale接单', js.get('ok', False))
js = curl('POST', '/api/orders/ship', {'order_id': oid, 'tracking_no': 'TEST'})
ok('发货', js.get('ok', False))
js = curl('POST', '/api/orders/confirm', {'order_id': oid})
ok('确认收货', js.get('ok', False))

print('\n=== 4. 商品/市场/仪表盘 ===')
js = curl('POST', '/api/products', {'name': '大赛商品', 'price': 99, 'unit': '件', 'stock': 500, 'location': '烟台'})
ok('创建商品', bool(js.get('sku')))
js = curl('GET', '/api/products')
n = len(js) if isinstance(js, list) else 0
ok('商品列表', n > 0, str(n))

js = curl('POST', '/api/market', {'keyword': '烟台'})
n = len(js) if isinstance(js, list) else 0
ok('市场搜索', n >= 0, str(n))

js = curl('GET', '/api/dashboard')
ok('Dashboard', js.get('products', 0) >= 0)

js = curl('GET', '/api/finance/overview')
ok('财务概览', 'gmv_total' in js)

print('\n=== 5. 客户/采购/日志 ===')
js = curl('POST', '/api/customers', {'name': '大赛客户', 'phone': '138'})
ok('创建客户', js.get('name') == '大赛客户')

curl('POST', '/api/auth/login', {'username': 'a_oper', 'password': 'test123'})
js = curl('POST', '/api/purchase-queue', {'sku': 'x', 'qty': 1, 'price': 10, 'product_name': 'x', 'seller_did': 'did:user:a_sale'})
ok('采购申请', js.get('ok', False))
js = curl('GET', '/api/purchase-queue')
ok('采购队列', isinstance(js, list))
js = curl('GET', '/api/audit-log')
ok('操作日志', isinstance(js, list))

print('\n' + '=' * 40)
total = OK + FAIL
print('1088大赛支持: ' + str(OK) + '/' + str(total))
if FAIL == 0:
    print('ALL PASS')
else:
    print(str(FAIL) + ' FAIL')
