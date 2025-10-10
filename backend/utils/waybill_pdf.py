from __future__ import annotations

import os
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

# Try find system fonts with Cyrillic support (do not add binaries to repo)
_FONT_NAME = "Helvetica"
_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/local/share/fonts/DejaVuSans.ttf",
    "C:\\Windows\\Fonts\\arial.ttf",
]

for path in _CANDIDATES:
    if os.path.exists(path):
        try:
            pdfmetrics.registerFont(TTFont("WaybillCyr", path))
            _FONT_NAME = "WaybillCyr"
            break
        except Exception:
            pass

_styles = getSampleStyleSheet()
TITLE = ParagraphStyle(
    "TITLE",
    parent=_styles["Title"],
    fontName=_FONT_NAME,
    fontSize=18,
    leading=22,
    alignment=TA_LEFT,
    spaceAfter=8,
)
LABEL = ParagraphStyle(
    "LABEL",
    parent=_styles["Normal"],
    fontName=_FONT_NAME,
    fontSize=10,
    leading=13,
)
CELL = ParagraphStyle(
    "CELL",
    parent=_styles["Normal"],
    fontName=_FONT_NAME,
    fontSize=10,
    leading=12,
)
CELL_CENTER = ParagraphStyle(
    "CELL_CENTER",
    parent=CELL,
    alignment=TA_CENTER,
)


def render_waybill_pdf(p: dict) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=28,
        rightMargin=28,
        topMargin=28,
        bottomMargin=28,
    )
    story = []

    story.append(Paragraph(f"Накладная № {p['id']}", TITLE))
    story.append(Paragraph(f"<b>Откуда:</b> {p['from_branch']}", LABEL))
    story.append(Paragraph(f"<b>Куда:</b> {p['to_branch']}", LABEL))
    story.append(Paragraph(f"<b>Дата:</b> {p['created_at']}", LABEL))
    story.append(Spacer(1, 10))

    thead = [[
        Paragraph("№", CELL_CENTER),
        Paragraph("Наименование", CELL),
        Paragraph("Ед.", CELL_CENTER),
        Paragraph("Кол-во", CELL_CENTER),
    ]]
    body = []
    for i, r in enumerate(p["items"], start=1):
        body.append([
            Paragraph(str(i), CELL_CENTER),
            Paragraph(r["name"], CELL),
            Paragraph("шт", CELL_CENTER),
            Paragraph(str(r["quantity"]), CELL_CENTER),
        ])
    tbl = Table(thead + body, colWidths=[22, 350, 40, 60])
    tbl.setStyle(
        TableStyle([
            ("FONTNAME", (0, 0), (-1, -1), _FONT_NAME),
            ("FONTSIZE", (0, 0), (-1, -1), 10),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.black),
            ("BACKGROUND", (0, 0), (-1, 0), colors.whitesmoke),
            ("ALIGN", (0, 0), (-1, 0), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ])
    )
    story.append(tbl)

    story.append(Spacer(1, 12))
    story.append(
        Paragraph(
            f"<b>Всего позиций:</b> {len(p['items'])}, <b>Всего единиц:</b> {p['total_quantity']}",
            LABEL,
        )
    )
    story.append(Spacer(1, 16))
    story.append(
        Paragraph(
            "Отпустил: ______________________________  Подпись: ____________",
            LABEL,
        )
    )
    story.append(Spacer(1, 6))
    story.append(
        Paragraph(
            "Принял:   ______________________________  Подпись: ____________",
            LABEL,
        )
    )

    doc.build(story)
    return buf.getvalue()
