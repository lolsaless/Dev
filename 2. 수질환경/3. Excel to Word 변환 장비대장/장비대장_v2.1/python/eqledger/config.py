"""[부품 P0] 설정 — HTML 판과 같은 assets/config.json 을 읽는다."""
import json
import os

ASSETS = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'assets')
CONFIG = json.load(open(os.path.join(ASSETS, 'config.json'), encoding='utf-8'))
VERSION = CONFIG['version']
FORM = CONFIG['form']
TEMPLATE_PATH = os.path.join(ASSETS, 'ledger.docx')
CATALOG_TEMPLATE_PATH = os.path.join(ASSETS, 'catalog_template.html')
