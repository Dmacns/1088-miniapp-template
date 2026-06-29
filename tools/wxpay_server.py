#!/usr/bin/env python3
"""
DMACNS 微信支付后端
部署: 43.139.194.155:4197
小程序调 POST /api/wxpay/prepay 获取支付参数，然后调 wx.requestPayment
"""
import json, time, hashlib, random, string
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.request import Request, urlopen

PORT = 4197

# ===== 配置（商户号下来后替换） =====
WX_APPID = '你的小程序AppID'
WX_MCHID = '你的商户号'
WX_API_KEY = '你的API密钥'
WX_NOTIFY_URL = 'https://dmacns.com/api/wxpay/notify'

# 模拟模式：商户号未配置时走模拟
MOCK_MODE = WX_MCHID == '你的商户号'


def wx_sign(params: dict) -> str:
    """微信支付签名"""
    s = '&'.join(f'{k}={params[k]}' for k in sorted(params) if params[k])
    s += f'&key={WX_API_KEY}'
    return hashlib.md5(s.encode()).hexdigest().upper()


def wx_unified_order(out_trade_no: str, total_fee: int, body: str, openid: str = ''):
    """统一下单 → 返回 prepay_id"""
    params = {
        'appid': WX_APPID,
        'mch_id': WX_MCHID,
        'nonce_str': ''.join(random.choices(string.ascii_letters + string.digits, k=32)),
        'body': body,
        'out_trade_no': out_trade_no,
        'total_fee': total_fee,  # 单位：分
        'spbill_create_ip': '43.139.194.155',
        'notify_url': WX_NOTIFY_URL,
        'trade_type': 'JSAPI',
        'openid': openid,
    }
    params['sign'] = wx_sign(params)
    xml_body = '<xml>' + ''.join(f'<{k}>{v}</{k}>' for k, v in params.items()) + '</xml>'
    req = Request('https://api.mch.weixin.qq.com/pay/unifiedorder', data=xml_body.encode())
    resp = urlopen(req, timeout=10).read().decode()
    # 提取 prepay_id
    import re
    m = re.search(r'<prepay_id><!\[CDATA\[(\w+)\]\]></prepay_id>', resp)
    if m:
        return m.group(1)
    m2 = re.search(r'<return_msg><!\[CDATA\[(.+?)\]\]></return_msg>', resp)
    raise Exception(m2.group(1) if m2 else resp)


def make_pay_params(prepay_id: str) -> dict:
    """生成小程序 wx.requestPayment 所需参数"""
    params = {
        'appId': WX_APPID,
        'timeStamp': str(int(time.time())),
        'nonceStr': ''.join(random.choices(string.ascii_letters + string.digits, k=32)),
        'package': f'prepay_id={prepay_id}',
        'signType': 'MD5',
    }
    params['paySign'] = wx_sign(params)
    return params


class Handler(BaseHTTPRequestHandler):
    def _json(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        length = int(self.headers.get('Content-Length', 0))
        body = json.loads(self.rfile.read(length)) if length > 0 else {}

        if self.path == '/api/wxpay/prepay':
            amount = body.get('amount', 0)  # 单位：元
            order_id = body.get('orderId', '')
            product = body.get('productName', '商品')
            openid = body.get('openid', '')

            if MOCK_MODE:
                # 模拟模式 — 返回测试prepay_id
                self._json({
                    'ok': True,
                    'mock': True,
                    'timeStamp': str(int(time.time())),
                    'nonceStr': 'mock_nonce',
                    'package': 'prepay_id=mock_prepay_12345',
                    'signType': 'MD5',
                    'paySign': 'MOCK_SIGN',
                })
                return

            try:
                total_fee = max(1, int(amount * 100))  # 元 → 分，最少1分
                prepay_id = wx_unified_order(order_id, total_fee, product, openid)
                pay_params = make_pay_params(prepay_id)
                self._json({'ok': True, **pay_params})
            except Exception as e:
                self._json({'ok': False, 'error': str(e)}, 400)

        elif self.path == '/api/wxpay/notify':
            # 微信支付回调（TODO: 验签 + 更新订单状态）
            print('[WXPAY] 回调通知:', body)
            self.send_response(200)
            self.send_header('Content-Type', 'text/xml')
            self.end_headers()
            self.wfile.write(b'<xml><return_code>SUCCESS</return_code></xml>')

        else:
            self._json({'error': 'not found'}, 404)


if __name__ == '__main__':
    print(f'支付后端启动 :{PORT} | {"模拟模式" if MOCK_MODE else "生产模式"}')
    HTTPServer(('0.0.0.0', PORT), Handler).serve_forever()
