from __future__ import annotations


def render_waybill_html(p: dict) -> str:
    # Minimal, print-friendly HTML. Uses system fonts; good Cyrillic in browser.
    items_rows = "\n".join(
        f"<tr><td style='text-align:center'>{i+1}</td><td>{r['name']}</td><td style='text-align:center'>шт</td><td style='text-align:center'>{r['quantity']}</td></tr>"
        for i, r in enumerate(p["items"])
    )
    return f"""<!doctype html>
<html lang=\"ru\">
<head>
  <meta charset=\"utf-8\"/>
  <title>Накладная № {p['id']}</title>
  <style>
    body {{ font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, \"Noto Sans\", \"DejaVu Sans\", sans-serif; margin: 32px; }}
    h1 {{ font-size: 20px; margin: 0 0 12px; }}
    .meta {{ margin: 8px 0 16px; }}
    table {{ width: 100%; border-collapse: collapse; }}
    th, td {{ border: 1px solid #000; padding: 6px 8px; font-size: 12px; }}
    th {{ background: #f0f0f0; }}
    .sign {{ margin-top: 24px; font-size: 12px; }}
    .sign-row {{ display:flex; gap:28px; margin:8px 0; align-items:center; }}
    .line {{ flex: 1; border-bottom:1px solid #000; height: 16px; }}
    @media print {{
      @page {{ size: A4; margin: 16mm; }}
      .no-print {{ display:none; }}
    }}
  </style>
</head>
<body>
  <h1>Накладная № {p['id']}</h1>
  <div class=\"meta\">
    <div><b>Откуда:</b> {p['from_branch']}</div>
    <div><b>Куда:</b> {p['to_branch']}</div>
    <div><b>Дата:</b> {p['created_at']}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th style=\"width:5%\">№</th>
        <th>Наименование</th>
        <th style=\"width:10%\">Ед.</th>
        <th style=\"width:12%\">Кол-во</th>
      </tr>
    </thead>
    <tbody>
      {items_rows}
    </tbody>
  </table>

  <div class=\"meta\"><b>Всего позиций:</b> {len(p['items'])}, <b>Всего единиц:</b> {p['total_quantity']}</div>

  <div class=\"sign\">
    <div class=\"sign-row\"><span>Отпустил:</span><div class=\"line\"></div><span>Подпись:</span><div class=\"line\" style=\"max-width:120px\"></div></div>
    <div class=\"sign-row\"><span>Принял:</span><div class=\"line\"></div><span>Подпись:</span><div class=\"line\" style=\"max-width:120px\"></div></div>
  </div>

  <div class=\"no-print\" style=\"margin-top:16px\">
    <button onclick=\"window.print()\">Печать</button>
  </div>
</body>
</html>"""
