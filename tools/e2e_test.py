#!/usr/bin/env python3
"""小程序P2P全链路端到端测试"""
import asyncio, websockets, json, time

WS = 'ws://43.139.194.155:9001'
BUYER = 'did:test:buyer_001'
SELLER = 'did:test:seller_001'

results = []

def ok(test, passed, detail=''):
    status = '✅' if passed else '❌'
    results.append((test, passed, detail))
    print(f'  {status} {test} {detail}')

async def buyer_flow():
    """买家流程：搜索→下单→收货→评价"""
    async with websockets.connect(WS) as ws:
        # 注册
        await ws.send(json.dumps({'cmd': 'REGISTER', 'payload': {'node_id': BUYER}}))
        msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=5))
        ok('买家注册', msg.get('cmd') == 'WELCOME', f"peers={msg.get('payload',{}).get('peers')}")

        # 搜索
        await ws.send(json.dumps({'cmd': 'DISCOVER', 'payload': {'product': '苹果'}}))
        msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=5))
        sellers = msg.get('sellers', [])
        ok('搜索商品', len(sellers) > 0, f'找到{len(sellers)}个卖家')
        if not sellers:
            return False

        seller = sellers[0]
        price = seller.get('price_min', 10)
        order_id = f'auto_test_{int(time.time())}'

        # 下单
        await ws.send(json.dumps({'cmd': 'PROPOSE', 'payload': {
            'order_id': order_id, 'buyer_did': BUYER, 'seller_did': SELLER,
            'product': seller.get('product', '苹果'), 'quantity': 5,
            'price': price, 'total': price * 5
        }}))
        msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=5))
        ok('下单', msg.get('cmd') == 'PROPOSE', f"order_id={order_id}")

        # 等待卖家接单 (SHIP_NOTIFY)
        try:
            msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=10))
            if msg.get('cmd') == 'ACCEPT':
                ok('收到接单确认', True)
            elif msg.get('cmd') == 'SHIP_NOTIFY':
                ok('收到发货通知', msg.get('payload',{}).get('tracking_no','') != '')
            else:
                ok(f'收到{msg.get("cmd")}', True)
        except:
            ok('等待卖家响应', False, '超时')

        return True


async def seller_flow():
    """卖家流程：发布→接单→发货"""
    async with websockets.connect(WS) as ws:
        # 注册
        await ws.send(json.dumps({'cmd': 'REGISTER', 'payload': {'node_id': SELLER}}))
        msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=5))
        ok('卖家注册', msg.get('cmd') == 'WELCOME')

        # 发布商品
        await ws.send(json.dumps({'cmd': 'PUBLISH', 'payload': {
            'node_id': SELLER, 'product': '烟台红富士苹果',
            'price_min': 8, 'price_max': 15, 'location': '山东烟台',
            'category': '斤', 'stock': 200, 'description': '脆甜多汁', 'tags': []
        }}))
        msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=5))
        ok('发布商品', msg.get('cmd') == 'PUBLISH_ACK', msg.get('payload',{}).get('status',''))

        # 等待订单
        try:
            msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=15))
            if msg.get('cmd') in ('PROPOSE', 'ORDER'):
                order_id = msg.get('payload',{}).get('order_id','')
                ok('收到订单', True, f"order_id={order_id}")

                # 接单
                await ws.send(json.dumps({'cmd': 'ACCEPT', 'payload': {'order_id': order_id}}))

                # 发货
                await ws.send(json.dumps({'cmd': 'SHIP_NOTIFY', 'payload': {
                    'order_id': order_id, 'tracking_no': 'SF1234567890',
                    'buyer_did': BUYER, 'seller_did': SELLER
                }}))
                ok('接单+发货', True, order_id)
            else:
                ok('收到订单', False, f'收到{msg.get("cmd")}而非ORDER')
        except asyncio.TimeoutError:
            ok('等待订单', False, '超时(15s)')

        return True


async def test_dispute():
    """争议流程"""
    async with websockets.connect(WS) as ws:
        await ws.send(json.dumps({'cmd': 'REGISTER', 'payload': {'node_id': BUYER}}))
        await ws.recv()

        dispute_id = f'disp_test_{int(time.time())}'
        await ws.send(json.dumps({'cmd': 'DISPUTE', 'payload': {
            'dispute_id': dispute_id, 'order_id': 'auto_test_order',
            'buyer_did': BUYER, 'seller_did': SELLER,
            'reason': '质量问题', 'description': '商品与描述不符', 'status': 'open'
        }}))
        try:
            msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=5))
            ok('发起争议', msg.get('cmd') != 'ERROR', dispute_id)
        except:
            ok('发起争议', False, '超时')


async def test_registration():
    """登记API测试"""
    import urllib.request
    try:
        data = json.dumps({'name': '自动测试', 'city': '烟台', 'phone': '13900000000',
                           'contact': 'wx_test', 'categories': ['校园二手']}).encode()
        req = urllib.request.Request('https://dmacns.com/api/register', data=data,
                                     headers={'Content-Type': 'application/json'})
        resp = urllib.request.urlopen(req, timeout=10)
        result = json.loads(resp.read())
        ok('大赛登记API', result.get('ok') == True or result.get('success') == True,
           f"id={result.get('id','?')}")
    except Exception as e:
        ok('大赛登记API', False, str(e)[:60])


async def main():
    print('=' * 50)
    print('小程序端到端测试')
    print('=' * 50)

    print('\n📋 登记API')
    await test_registration()

    print('\n🔄 P2P两设备全链路')
    # 先启动卖家，再启动买家
    seller_task = asyncio.create_task(seller_flow())
    await asyncio.sleep(2)  # 等卖家注册+发布完成
    await buyer_flow()
    await seller_task

    print('\n⚖️ 争议流程')
    await test_dispute()

    print('\n' + '=' * 50)
    passed = sum(1 for _, p, _ in results if p)
    total = len(results)
    print(f'结果: {passed}/{total} 通过')
    for test, p, detail in results:
        print(f'  {"✅" if p else "❌"} {test} {detail}')
    print('=' * 50)

asyncio.run(main())
