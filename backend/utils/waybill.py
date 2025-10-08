from __future__ import annotations

import os
from dataclasses import dataclass, field
from datetime import datetime
from io import BytesIO
from typing import List, Optional

from zoneinfo import ZoneInfo

from reportlab.graphics.barcode import qr
from reportlab.graphics.shapes import Drawing
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

ALMATY_TZ = ZoneInfo("Asia/Almaty")


def now_almaty() -> datetime:
    return datetime.now(tz=ALMATY_TZ)


def safe_filename(prefix: str, id_: str | int, ext: str = "pdf") -> str:
    raw = f"{id_}"
    sanitized = "".join(ch if ch.isalnum() or ch in ("-", "_") else "_" for ch in raw)
    return f"{prefix}_{sanitized}.{ext}"


@dataclass(slots=True)
class WaybillItem:
    name: str
    item_type: str  # "medicine" | "medical_device"
    quantity: int
    unit: str = "шт."
    note: Optional[str] = None


@dataclass(slots=True)
class WaybillData:
    document_id: str
    number: str
    created_at: datetime
    sender: str
    receiver: str
    items: List[WaybillItem] = field(default_factory=list)
    comment: Optional[str] = None
    prepared_by: Optional[str] = None
    received_by: Optional[str] = None
    company_name: Optional[str] = None
    qr_value: Optional[str] = None


_FONT_READY = False
_FONT_MAIN = "Helvetica"
_FONT_BOLD = "Helvetica-Bold"


def _ensure_fonts() -> None:
    global _FONT_READY, _FONT_MAIN, _FONT_BOLD
    if _FONT_READY:
        return

    normal_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    bold_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
    try:
        if os.path.exists(normal_path):
            pdfmetrics.registerFont(TTFont("DejaVuSans", normal_path))
            _FONT_MAIN = "DejaVuSans"
        if os.path.exists(bold_path):
            pdfmetrics.registerFont(TTFont("DejaVuSans-Bold", bold_path))
            _FONT_BOLD = "DejaVuSans-Bold"
    except Exception:
        # If font registration fails, fall back to default fonts
        _FONT_MAIN = "Helvetica"
        _FONT_BOLD = "Helvetica-Bold"
    finally:
        _FONT_READY = True


def _format_datetime(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=ZoneInfo("UTC")).astimezone(ALMATY_TZ)
    return dt.astimezone(ALMATY_TZ)


def _build_qr_drawing(value: str, size: int = 80) -> Drawing:
    """
    Возвращает Drawing с QR-кодом указанного размера (px).
    Трансформацию задаём на самом виджете, а не через Drawing.add(..., transform=...).
    """
    # Если нет значения для QR — возвращаем пустой контейнер нужного размера
    if not value:
        return Drawing(size, size)

    widget = qr.QrCodeWidget(value)

    # Получаем естественные границы QR и считаем коэффициенты масштабирования
    x0, y0, x1, y1 = widget.getBounds()
    w = (x1 - x0) or 1
    h = (y1 - y0) or 1

    sx = float(size) / float(w)
    sy = float(size) / float(h)

    # Применяем трансформацию к самому виджету (совместимо с разными версиями reportlab)
    try:
        widget.transform = [sx, 0, 0, sy, 0, 0]  # scale
    except Exception:
        try:
            widget.scale(sx, sy)
        except Exception:
            pass  # в крайнем случае оставим без масштабирования

    # Собираем Drawing требуемого размера и добавляем виджет без transform=
    d = Drawing(size, size)
    d.add(widget)
    return d


def render_waybill_pdf(data: WaybillData) -> bytes:
    _ensure_fonts()

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=22 * mm,
        bottomMargin=20 * mm,
        title=f"Waybill {data.number}",
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        name="WaybillTitle",
        parent=styles["Title"],
        fontName=_FONT_BOLD,
        fontSize=16,
        alignment=1,
        spaceAfter=6,
    )
    subtitle_style = ParagraphStyle(
        name="WaybillSubtitle",
        parent=styles["Normal"],
        fontName=_FONT_BOLD,
        fontSize=11,
        alignment=1,
        spaceAfter=6,
    )
    meta_style = ParagraphStyle(
        name="WaybillMeta",
        parent=styles["Normal"],
        fontName=_FONT_MAIN,
        fontSize=10,
        leading=14,
        spaceAfter=4,
    )
    normal_style = ParagraphStyle(
        name="WaybillNormal",
        parent=styles["Normal"],
        fontName=_FONT_MAIN,
        fontSize=11,
        leading=16,
        spaceAfter=2,
    )
    small_style = ParagraphStyle(
        name="WaybillSmall",
        parent=styles["Normal"],
        fontName=_FONT_MAIN,
        fontSize=9,
        leading=12,
        spaceAfter=2,
    )

    story: List = []

    if data.company_name:
        story.append(Paragraph(data.company_name, subtitle_style))

    story.append(Paragraph(f"НАКЛАДНАЯ № {data.number}", title_style))
    local_dt = _format_datetime(data.created_at)
    story.append(
        Paragraph(
            f"Дата: {local_dt.strftime('%d.%m.%Y %H:%M')} (Asia/Almaty)",
            meta_style,
        )
    )
    story.append(Spacer(1, 6))

    story.append(Paragraph(f"Отправитель: {data.sender}", normal_style))
    story.append(Paragraph(f"Получатель: {data.receiver}", normal_style))
    story.append(Spacer(1, 10))

    table_data = [
        ["№", "Наименование", "Тип", "Кол-во", "Ед.", "Примечание"],
    ]
    for idx, item in enumerate(data.items, start=1):
        type_label = "ЛС" if item.item_type == "medicine" else "ИМН"
        table_data.append(
            [
                str(idx),
                item.name,
                type_label,
                f"{item.quantity}",
                item.unit or "шт.",
                item.note or "",
            ]
        )

    table = Table(
        table_data,
        colWidths=[12 * mm, 70 * mm, 20 * mm, 24 * mm, 20 * mm, 42 * mm],
        repeatRows=1,
    )
    table.setStyle(
        TableStyle(
            [
                ("FONT", (0, 0), (-1, 0), _FONT_BOLD),
                ("FONTSIZE", (0, 0), (-1, 0), 10),
                ("ALIGN", (0, 0), (0, -1), "CENTER"),
                ("ALIGN", (2, 1), (4, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.whitesmoke]),
                ("FONT", (0, 1), (-1, -1), _FONT_MAIN),
            ]
        )
    )
    story.append(table)

    total_qty = sum(item.quantity for item in data.items)
    story.append(Spacer(1, 8))
    story.append(
        Paragraph(
            f"Итого строк: {len(data.items)}  |  Общее количество: {total_qty}",
            normal_style,
        )
    )

    if data.comment:
        story.append(Spacer(1, 6))
        story.append(Paragraph("Комментарий:", small_style))
        story.append(
            Paragraph(data.comment.replace("\n", "<br/>"), small_style)
        )

    story.append(Spacer(1, 14))

    signatures = Table(
        [
            ["Отпустил", "", "Принял", ""],
            ["____________________", "", "____________________", ""],
            [data.prepared_by or "", "", data.received_by or "", ""],
        ],
        colWidths=[45 * mm, 15 * mm, 45 * mm, 15 * mm],
    )
    signatures.setStyle(
        TableStyle(
            [
                ("FONT", (0, 0), (-1, 0), _FONT_BOLD),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("FONT", (0, 1), (-1, 2), _FONT_MAIN),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
            ]
        )
    )
    story.append(signatures)

    if data.qr_value:
        story.append(Spacer(1, 12))
        story.append(Paragraph("QR-код для проверки:", small_style))
        story.append(_build_qr_drawing(data.qr_value))

    doc.build(story)
    return buffer.getvalue()
