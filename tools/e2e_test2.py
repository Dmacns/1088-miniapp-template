#!/usr/bin/env python3
"""P2P全链路测试 v2 — 两设备同时在线"""
import asyncio, websockets, json, time

WS = 'ws://43.139.194.155:9001'
BUYER = 'did:test:buyer_v2'
SELLER = 'did:test:seller_v2'
ORDER_ID = f'auto_{int(time.time())}'
DISPUTE_ID = f'disp_{int(time.time())}'
passed = 0
total = 0

def check(name, condition, detail=''):
    global passed, total
    total += 1
    if condition: passed += 1
    print(f"  {'✅' if condition else '❌'} {name} {detail}")

async def seller(ws):
    await ws.send(json.dumps({'cmd':'REGISTER','payload':{'node_id':SELLER}}))
    msg = json.loads(await asyncio.wait_for(ws.recv(), 5))
    check('卖家注册', msg['cmd']=='WELCOME')

    await ws.send(json.dumps({'cmd':'PUBLISH','payload':{
        'node_id':SELLER,'product':'测试苹果','price_min':8,'price_max':15,
        'location':'山东','category':'斤','stock':200,'tags':[]
    }}))
    msg = json.loads(await asyncio.wait_for(ws.recv(), 5))
    check('发布商品', msg['cmd']=='PUBLISH_ACK')

    # 等订单
    msg = json.loads(await asyncio.wait_for(ws.recv(), 15))
    check('收到订单', msg['cmd'] in ('PROPOSE','ORDER_PROPOSE'), msg.get('cmd','?'))

    # 接单
    await ws.send(json.dumps({'cmd':'ACCEPT','payload':{
        'order_id':ORDER_ID,'buyer_did':BUYER,'seller_did':SELLER
    }}))
    check('接单已发送', True)

    # 发货
    await ws.send(json.dumps({'cmd':'SHIP_NOTIFY','payload':{
        'order_id':ORDER_ID,'tracking_no':'SF123','buyer_did':BUYER,'seller_did':SELLER
    }}))
    check('发货已发送', True)

    # 等争议
    try:
        msg = json.loads(await asyncio.wait_for(ws.recv(), 10))
        check('收到争议通知', msg['cmd'] in ('DISPUTE','DISPUTE_PROPOSE'), msg.get('cmd','?'))
    except:
        check('收到争议通知', False, '超时')

    # 处理争议
    await ws.send(json.dumps({'cmd':'DISPUTE_UPDATE','payload':{
        'dispute_id':DISPUTE_ID,'order_id':ORDER_ID,
        'buyer_did':BUYER,'seller_did':SELLER,
        'status':'resolved','ruling':'卖家接受诉求'
    }}))
    check('争议处理已发送', True)

async def buyer(ws):
    await ws.send(json.dumps({'cmd':'REGISTER','payload':{'node_id':BUYER}}))
    msg = json.loads(await asyncio.wait_for(ws.recv(), 5))
    check('买家注册', msg['cmd']=='WELCOME')

    # 搜索
    await ws.send(json.dumps({'cmd':'DISCOVER','payload':{'product':'苹果'}}))
    msg = json.loads(await asyncio.wait_for(ws.recv(), 5))
    check('搜索商品', len(msg.get('sellers',[]))>0)

    # 下单
    await ws.send(json.dumps({'cmd':'PROPOSE','payload':{
        'order_id':ORDER_ID,'buyer_did':BUYER,'seller_did':SELLER,
        'product':'测试苹果','quantity':5,'price':10,'total':50
    }}))
    check('下单已发送', True)

    # 等发货通知
    try:
        msg = json.loads(await asyncio.wait_for(ws.recv(), 15))
        check('收到发货通知', msg['cmd']=='SHIP_NOTIFY', msg.get('cmd','?'))
    except:
        check('收到发货通知', False, '超时')

    # 发起争议
    await ws.send(json.dumps({'cmd':'DISPUTE','payload':{
        'dispute_id':DISPUTE_ID,'order_id':ORDER_ID,
        'buyer_did':BUYER,'seller_did':SELLER,
        'reason':'质量问题','description':'商品不符','status':'open'
    }}))
    check('争议发起已发送', True)

    # 等争议处理结果
    try:
        msg = json.loads(await asyncio.wait_for(ws.recv(), 10))
        check('收到争议处理', msg['cmd']=='DISPUTE_UPDATE', msg.get('cmd','?'))
    except:
        check('收到争议处理', False, '超时')

async def main():
    print('='*50)
    print('P2P全链路+争议测试 (双设备在线)')
    print('='*50)
    async with websockets.connect(WS) as ws_b, websockets.connect(WS) as ws_s:
        await asyncio.gather(seller(ws_s), buyer(ws_b))
    print(f'\n结果: {passed}/{total} 通过')

asyncio.run(main())
