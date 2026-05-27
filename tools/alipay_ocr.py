#!/usr/bin/env python3
"""
支付宝基金交易截图识别工具 (Alipay Fund Transaction OCR)

使用 EasyOCR 离线中文识别引擎，从支付宝基金交易记录截图中提取：
- 基金名称
- 基金编号（通过东方财富 API 反查）
- 交易类型（买入/卖出/转换）
- 交易金额/份额
- 交易时间

用法:
    python alipay_ocr.py <image_path> [image_path2 ...]
    python alipay_ocr.py eg.png eg2.png
    python alipay_ocr.py eg.png --no-lookup     # 跳过基金编号反查
    python alipay_ocr.py eg.png --json           # 输出纯 JSON
    python alipay_ocr.py eg.png --csv output.csv  # 导出 CSV
"""

import sys
import os
import re
import json
import argparse
import urllib.request
import urllib.parse
from dataclasses import dataclass, field, asdict
from typing import Optional


# ─── ANSI Color Helpers ───────────────────────────────────────────────────
class C:
    """Terminal color codes for pretty output."""
    RESET   = "\033[0m"
    BOLD    = "\033[1m"
    DIM     = "\033[2m"
    RED     = "\033[91m"
    GREEN   = "\033[92m"
    YELLOW  = "\033[93m"
    BLUE    = "\033[94m"
    MAGENTA = "\033[95m"
    CYAN    = "\033[96m"
    WHITE   = "\033[97m"
    BG_DARK = "\033[48;5;236m"

    @staticmethod
    def supports_color():
        return hasattr(sys.stdout, 'isatty') and sys.stdout.isatty()


def styled(text, *styles):
    if not C.supports_color():
        return text
    prefix = "".join(styles)
    return f"{prefix}{text}{C.RESET}"


# ─── Data Models ──────────────────────────────────────────────────────────
@dataclass
class Transaction:
    """Parsed transaction from Alipay fund screenshot."""
    fund_name: str = ""
    fund_code: str = ""
    trade_type: str = ""       # 买入 / 卖出 / 转换
    amount: float = 0.0
    amount_unit: str = "元"    # 元 or 份
    trade_time: str = ""
    # For 转换 type
    convert_from: str = ""
    convert_to: str = ""
    # Raw OCR text for debugging
    raw_text: str = ""


# ─── OCR Engine ───────────────────────────────────────────────────────────
_reader = None

def get_ocr_reader():
    """Lazily initialize the EasyOCR reader (downloads model on first use)."""
    global _reader
    if _reader is None:
        try:
            import easyocr
        except ImportError:
            print(styled("✖ EasyOCR 未安装。请运行:", C.RED, C.BOLD))
            print(styled("  pip install easyocr", C.CYAN))
            sys.exit(1)
        print(styled("⟳ 正在初始化 OCR 引擎（首次运行需下载中文模型，约 100MB）...", C.DIM))
        _reader = easyocr.Reader(['ch_sim', 'en'], gpu=False, verbose=False)
        print(styled("✔ OCR 引擎就绪", C.GREEN))
    return _reader


def run_ocr(image_path: str) -> list[tuple]:
    """
    Run OCR on an image and return list of (bbox, text, confidence).
    Results are sorted top-to-bottom, left-to-right by bounding box position.
    """
    reader = get_ocr_reader()
    results = reader.readtext(image_path, detail=1, paragraph=False)

    # Sort by vertical position (top of bbox), then horizontal
    def sort_key(item):
        bbox = item[0]
        # bbox is [[x1,y1],[x2,y2],[x3,y3],[x4,y4]]
        top_y = min(pt[1] for pt in bbox)
        left_x = min(pt[0] for pt in bbox)
        return (top_y, left_x)

    results.sort(key=sort_key)
    return results


# ─── Smart Line Grouping ─────────────────────────────────────────────────
def group_ocr_into_lines(results: list[tuple], y_threshold: float = 20.0) -> list[list[dict]]:
    """
    Group OCR bounding boxes into logical lines based on vertical proximity.
    Each line is a list of {text, x, y, w, h, confidence} sorted left-to-right.
    """
    items = []
    for bbox, text, conf in results:
        xs = [pt[0] for pt in bbox]
        ys = [pt[1] for pt in bbox]
        items.append({
            'text': text.strip(),
            'x': min(xs),
            'y': min(ys),
            'w': max(xs) - min(xs),
            'h': max(ys) - min(ys),
            'conf': conf,
        })

    if not items:
        return []

    # Sort by y, then x
    items.sort(key=lambda it: (it['y'], it['x']))

    lines = []
    current_line = [items[0]]

    for item in items[1:]:
        # Check if this item is on the same line as the current group
        # Use the average y of current line items for comparison
        avg_y = sum(it['y'] for it in current_line) / len(current_line)
        if abs(item['y'] - avg_y) <= y_threshold:
            current_line.append(item)
        else:
            current_line.sort(key=lambda it: it['x'])
            lines.append(current_line)
            current_line = [item]

    if current_line:
        current_line.sort(key=lambda it: it['x'])
        lines.append(current_line)

    return lines


def lines_to_text_rows(lines: list[list[dict]]) -> list[str]:
    """Convert grouped lines into joined text strings."""
    return [" ".join(it['text'] for it in line) for line in lines]


# ─── OCR Text Normalization ──────────────────────────────────────────────
def normalize_ocr_text(text: str) -> str:
    """Fix common OCR misreads in Chinese financial text."""
    replacements = {
        '买人': '买入',
        '卖山': '卖出',
        '卖山': '卖出',
        '买人': '买入',
        '转挨': '转换',
        '转拢': '转换',
        '转撩': '转换',
        '基全': '基金',
        '混台': '混合',
        '联搂': '联接',
        '联按': '联接',
        '联接C': '联接C',
    }
    result = text
    for old, new in replacements.items():
        result = result.replace(old, new)

    # Fix o/O -> 0 in numeric contexts (e.g., "1,ooo.oo" -> "1,000.00")
    result = re.sub(r'(?<=\d)[oO]', '0', result)
    result = re.sub(r'[oO](?=\d)', '0', result)

    # Normalize full-width characters
    result = result.replace('，', ',')
    result = result.replace('。', '.')
    result = result.replace('：', ':')
    result = result.replace('｜', '|')
    result = result.replace('\u3000', ' ')

    return result


# ─── Transaction Parser ──────────────────────────────────────────────────

# Regex patterns
DATE_PATTERN = re.compile(
    r'(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})日?\s*'
    r'(\d{1,2})[:.：](\d{1,2})(?:[:.：](\d{1,2}))?'
)

AMOUNT_PATTERN = re.compile(
    r'([\d,]+\.?\d*)\s*(元|份)'
)

TYPE_KEYWORDS = {
    '买入': '买入',
    '买人': '买入',
    '卖出': '卖出',
    '卖山': '卖出',
    '转换': '转换',
    '转挨': '转换',
}

FUND_NAME_PREFIX = re.compile(r'基金\s*[|｜丨]\s*')
CONVERT_ARROW = re.compile(r'\s*[-—]+>\s*|\s*->\s*|\s*→\s*')


def parse_transactions(lines: list[list[dict]], text_rows: list[str]) -> list[Transaction]:
    """
    Parse grouped OCR lines into structured Transaction objects.
    
    Alipay transaction record layout (from screenshots):
    Line 1: [买入/卖出/转换]  基金 | <fund_name>           <amount><元/份>
    Line 2:                   <date time>                  [状态文字]
    """
    transactions = []
    normalized_rows = [normalize_ocr_text(row) for row in text_rows]

    i = 0
    while i < len(normalized_rows):
        row = normalized_rows[i]

        # Detect transaction type keyword
        trade_type = None
        for keyword, mapped_type in TYPE_KEYWORDS.items():
            if keyword in row:
                trade_type = mapped_type
                break

        if trade_type is None:
            i += 1
            continue

        tx = Transaction(trade_type=trade_type)
        tx.raw_text = row

        # ── Extract fund name ──
        # Remove type keyword prefix
        name_part = row
        for keyword in TYPE_KEYWORDS:
            name_part = name_part.replace(keyword, '', 1)
            break  # only remove first keyword match

        # Remove "基金 |" prefix
        name_part = FUND_NAME_PREFIX.sub('', name_part)

        # ── Extract amount ──
        amount_match = AMOUNT_PATTERN.search(name_part)
        if amount_match:
            raw_amount = amount_match.group(1).replace(',', '')
            try:
                tx.amount = float(raw_amount)
            except ValueError:
                tx.amount = 0.0
            tx.amount_unit = amount_match.group(2)
            # Remove amount from name_part
            name_part = name_part[:amount_match.start()] + name_part[amount_match.end():]

        # ── Handle conversion type (A -> B) ──
        if trade_type == '转换':
            arrow_match = CONVERT_ARROW.search(name_part)
            if arrow_match:
                from_name = name_part[:arrow_match.start()].strip()
                to_name = name_part[arrow_match.end():].strip()
                # Clean trailing dots/ellipsis
                to_name = re.sub(r'[.…。]+$', '', to_name).strip()
                from_name = re.sub(r'[.…。]+$', '', from_name).strip()
                tx.convert_from = from_name
                tx.convert_to = to_name
                tx.fund_name = from_name  # Primary name is the source fund
            else:
                tx.fund_name = name_part.strip()
        else:
            tx.fund_name = name_part.strip()

        # Clean up fund name: remove status text, trailing spaces, etc.
        tx.fund_name = re.sub(r'交易进行中.*$', '', tx.fund_name).strip()
        tx.fund_name = re.sub(r'预计.*到\s*$', '', tx.fund_name).strip()
        tx.fund_name = re.sub(r'预计.*账\s*$', '', tx.fund_name).strip()
        tx.fund_name = re.sub(r'[.…。]+$', '', tx.fund_name).strip()
        tx.fund_name = re.sub(r'\s+', '', tx.fund_name)  # Remove all spaces in fund name

        # ── Look at next line for date/time ──
        if i + 1 < len(normalized_rows):
            next_row = normalized_rows[i + 1]

            # Try to find date in current row first
            date_match = DATE_PATTERN.search(row)
            if not date_match:
                date_match = DATE_PATTERN.search(next_row)
                if date_match:
                    i += 1  # consume the date line

            if date_match:
                year = date_match.group(1)
                month = date_match.group(2).zfill(2)
                day = date_match.group(3).zfill(2)
                hour = date_match.group(4).zfill(2)
                minute = date_match.group(5).zfill(2)
                second = (date_match.group(6) or '00').zfill(2)
                tx.trade_time = f"{year}-{month}-{day} {hour}:{minute}:{second}"
        else:
            # Try date in current row
            date_match = DATE_PATTERN.search(row)
            if date_match:
                year = date_match.group(1)
                month = date_match.group(2).zfill(2)
                day = date_match.group(3).zfill(2)
                hour = date_match.group(4).zfill(2)
                minute = date_match.group(5).zfill(2)
                second = (date_match.group(6) or '00').zfill(2)
                tx.trade_time = f"{year}-{month}-{day} {hour}:{minute}:{second}"

        # Only add if we got meaningful data
        if tx.fund_name and (tx.amount > 0 or tx.trade_type == '转换'):
            transactions.append(tx)

        i += 1

    return transactions


# ─── Fund Code Lookup via Eastmoney API ──────────────────────────────────
def lookup_fund_code(fund_name: str) -> Optional[str]:
    """
    Look up fund code from Eastmoney API using fund name.
    Returns 6-digit fund code or None if not found.
    """
    try:
        clean_name = re.sub(r'[^a-zA-Z0-9\u4e00-\u9fa5]', '', fund_name)
        if len(clean_name) < 2:
            return None

        url = f"https://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx?m=1&key={urllib.parse.quote(clean_name)}"

        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://fund.eastmoney.com/',
        })

        with urllib.request.urlopen(req, timeout=5) as resp:
            raw = resp.read().decode('utf-8', errors='ignore')

        # Response is JSONP: callback({...}) or just JSON
        # Try to extract JSON content
        json_match = re.search(r'\{.*\}', raw, re.DOTALL)
        if not json_match:
            return None

        data = json.loads(json_match.group())
        datas = data.get('Datas', [])

        if not datas:
            return None

        # Find best match by name similarity
        best_match = None
        best_score = 0

        name_chars = set(re.sub(r'[^\\u4e00-\\u9fa5]', '', fund_name))

        for item in datas:
            item_name = item.get('NAME', '')
            item_chars = set(re.sub(r'[^\\u4e00-\\u9fa5]', '', item_name))

            if not name_chars or not item_chars:
                # Fallback: exact substring match
                if fund_name in item_name or item_name in fund_name:
                    return item.get('CODE', '')
                continue

            # Character overlap score
            overlap = len(name_chars & item_chars)
            score = overlap / max(len(name_chars), len(item_chars))

            if score > best_score:
                best_score = score
                best_match = item

        if best_match and best_score >= 0.5:
            return best_match.get('CODE', '')

        # Fallback: return first result if name contains our query
        first = datas[0]
        if clean_name in first.get('NAME', '') or first.get('NAME', '') in clean_name:
            return first.get('CODE', '')

        return datas[0].get('CODE', '') if datas else None

    except Exception as e:
        return None


def enrich_with_fund_codes(transactions: list[Transaction], verbose: bool = True) -> None:
    """Look up fund codes for all transactions and populate fund_code field."""
    names_to_lookup = set()
    for tx in transactions:
        if tx.fund_name:
            names_to_lookup.add(tx.fund_name)
        if tx.convert_to:
            names_to_lookup.add(tx.convert_to)

    if verbose and names_to_lookup:
        print(styled(f"\n⟳ 正在反查 {len(names_to_lookup)} 个基金编号...", C.DIM))

    code_cache = {}
    for name in names_to_lookup:
        if name not in code_cache:
            code = lookup_fund_code(name)
            code_cache[name] = code or ""
            if verbose:
                if code:
                    print(styled(f"  ✔ {name}", C.GREEN) + styled(f" → {code}", C.CYAN))
                else:
                    print(styled(f"  ✖ {name}", C.YELLOW) + styled(" → 未找到", C.DIM))

    for tx in transactions:
        tx.fund_code = code_cache.get(tx.fund_name, "")


# ─── Output Formatters ───────────────────────────────────────────────────
def print_results_table(transactions: list[Transaction], image_path: str) -> None:
    """Print results in a beautiful table format."""
    print()
    print(styled("━" * 100, C.DIM))
    print(styled(f"  📷 {os.path.basename(image_path)}", C.BOLD, C.CYAN) +
          styled(f"  —  识别到 {len(transactions)} 笔交易", C.DIM))
    print(styled("━" * 100, C.DIM))

    if not transactions:
        print(styled("  ⚠ 未识别到任何交易记录", C.YELLOW))
        print()
        return

    # Table header
    header = f"  {'#':>3}  {'类型':^6}  {'基金编号':^8}  {'基金名称':<30}  {'金额':>14}  {'时间':<20}"
    print(styled(header, C.BOLD, C.WHITE, C.BG_DARK))
    print(styled("─" * 100, C.DIM))

    for idx, tx in enumerate(transactions, 1):
        # Color code by type
        type_color = C.RED if tx.trade_type == '买入' else (C.GREEN if tx.trade_type == '卖出' else C.MAGENTA)
        type_str = styled(f"{tx.trade_type:^6}", type_color, C.BOLD)

        code_str = styled(tx.fund_code or "------", C.CYAN) if tx.fund_code else styled("------", C.DIM)

        # Fund name (truncate if too long)
        name = tx.fund_name
        if len(name) > 28:
            name = name[:26] + ".."

        amount_str = f"{tx.amount:>12,.2f}{tx.amount_unit}"
        if tx.trade_type == '买入':
            amount_str = styled(amount_str, C.RED)
        elif tx.trade_type == '卖出':
            amount_str = styled(amount_str, C.GREEN)
        else:
            amount_str = styled(amount_str, C.MAGENTA)

        time_str = styled(tx.trade_time or "未识别", C.DIM)

        print(f"  {styled(str(idx), C.DIM):>3}  {type_str}  {code_str:<8}  {name:<30}  {amount_str}  {time_str}")

        # Show conversion details
        if tx.trade_type == '转换' and (tx.convert_from or tx.convert_to):
            arrow = styled("→", C.MAGENTA, C.BOLD)
            from_str = styled(tx.convert_from or "?", C.YELLOW)
            to_str = styled(tx.convert_to or "?", C.CYAN)
            print(f"       {styled('└─ 转换:', C.DIM)} {from_str} {arrow} {to_str}")

    print(styled("━" * 100, C.DIM))
    print()


def to_json_output(transactions: list[Transaction]) -> str:
    """Convert transactions to formatted JSON string."""
    output = []
    for tx in transactions:
        d = {
            "基金名称": tx.fund_name,
            "基金编号": tx.fund_code,
            "交易类型": tx.trade_type,
            "交易金额": tx.amount,
            "金额单位": tx.amount_unit,
            "交易时间": tx.trade_time,
        }
        if tx.trade_type == '转换':
            d["转出基金"] = tx.convert_from
            d["转入基金"] = tx.convert_to
        output.append(d)
    return json.dumps(output, ensure_ascii=False, indent=2)


def export_csv(transactions: list[Transaction], filepath: str) -> None:
    """Export transactions to CSV file."""
    import csv

    with open(filepath, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.writer(f)
        writer.writerow(['基金名称', '基金编号', '交易类型', '交易金额', '金额单位', '交易时间', '转出基金', '转入基金'])
        for tx in transactions:
            writer.writerow([
                tx.fund_name, tx.fund_code, tx.trade_type,
                tx.amount, tx.amount_unit, tx.trade_time,
                tx.convert_from, tx.convert_to,
            ])

    print(styled(f"✔ 已导出 {len(transactions)} 条记录到 {filepath}", C.GREEN, C.BOLD))


# ─── Main Entry ───────────────────────────────────────────────────────────
def process_image(image_path: str, do_lookup: bool = True, verbose: bool = True) -> list[Transaction]:
    """Full pipeline: OCR -> Parse -> Lookup -> Return transactions."""
    if not os.path.isfile(image_path):
        print(styled(f"✖ 文件不存在: {image_path}", C.RED))
        return []

    if verbose:
        print(styled(f"\n📷 正在处理: {image_path}", C.BOLD, C.CYAN))

    # Step 1: Run OCR
    if verbose:
        print(styled("  ⟳ 执行 OCR 识别...", C.DIM))
    results = run_ocr(image_path)
    if verbose:
        print(styled(f"  ✔ OCR 完成，识别到 {len(results)} 个文本块", C.GREEN))

    # Step 2: Group into lines
    lines = group_ocr_into_lines(results)
    text_rows = lines_to_text_rows(lines)

    if verbose:
        print(styled("  ─ OCR 识别文本行:", C.DIM))
        for idx, row in enumerate(text_rows):
            print(styled(f"    [{idx:2d}] {row}", C.DIM))

    # Step 3: Parse transactions
    transactions = parse_transactions(lines, text_rows)
    if verbose:
        print(styled(f"  ✔ 解析完成，提取到 {len(transactions)} 笔交易", C.GREEN))

    # Step 4: Lookup fund codes
    if do_lookup and transactions:
        enrich_with_fund_codes(transactions, verbose=verbose)

    return transactions


def main():
    parser = argparse.ArgumentParser(
        description="支付宝基金交易截图识别工具 (Alipay Fund Transaction OCR)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python alipay_ocr.py eg.png
  python alipay_ocr.py eg.png eg2.png
  python alipay_ocr.py eg.png --no-lookup
  python alipay_ocr.py eg.png --json
  python alipay_ocr.py eg.png --csv result.csv
        """
    )
    parser.add_argument('images', nargs='+', help='支付宝交易记录截图路径')
    parser.add_argument('--no-lookup', action='store_true', help='跳过基金编号反查')
    parser.add_argument('--json', action='store_true', help='输出纯 JSON 格式')
    parser.add_argument('--csv', type=str, metavar='FILE', help='导出 CSV 文件')
    parser.add_argument('--debug', action='store_true', help='显示调试信息')

    args = parser.parse_args()

    print()
    print(styled("╔══════════════════════════════════════════════════════════╗", C.CYAN))
    print(styled("║", C.CYAN) + styled("  📱 支付宝基金交易截图识别工具", C.BOLD, C.WHITE) + styled("                         ║", C.CYAN))
    print(styled("║", C.CYAN) + styled("     EasyOCR 离线引擎 · 高精度中文识别", C.DIM) + styled("                ║", C.CYAN))
    print(styled("╚══════════════════════════════════════════════════════════╝", C.CYAN))

    all_transactions = []

    for image_path in args.images:
        txs = process_image(
            image_path,
            do_lookup=not args.no_lookup,
            verbose=not args.json,
        )

        if not args.json:
            print_results_table(txs, image_path)

        all_transactions.extend(txs)

    # Output
    if args.json:
        print(to_json_output(all_transactions))
    elif args.csv:
        export_csv(all_transactions, args.csv)

    if not args.json:
        print(styled(f"📊 总计: {len(all_transactions)} 笔交易", C.BOLD, C.WHITE))
        buy_count = sum(1 for tx in all_transactions if tx.trade_type == '买入')
        sell_count = sum(1 for tx in all_transactions if tx.trade_type == '卖出')
        convert_count = sum(1 for tx in all_transactions if tx.trade_type == '转换')
        if buy_count:
            buy_total = sum(tx.amount for tx in all_transactions if tx.trade_type == '买入' and tx.amount_unit == '元')
            print(styled(f"  🔴 买入 {buy_count} 笔", C.RED) + (styled(f" 合计 {buy_total:,.2f} 元", C.DIM) if buy_total else ""))
        if sell_count:
            sell_total = sum(tx.amount for tx in all_transactions if tx.trade_type == '卖出' and tx.amount_unit == '元')
            print(styled(f"  🟢 卖出 {sell_count} 笔", C.GREEN) + (styled(f" 合计 {sell_total:,.2f} 元", C.DIM) if sell_total else ""))
        if convert_count:
            print(styled(f"  🟣 转换 {convert_count} 笔", C.MAGENTA))
        print()


if __name__ == '__main__':
    main()
