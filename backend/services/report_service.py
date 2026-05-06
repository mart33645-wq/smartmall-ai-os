import io
import os
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics

import arabic_reshaper
from bidi.algorithm import get_display

from models.database import Shop, Task, Alert, ParkingSlot

class ReportService:
    @staticmethod
    def _prepare_arabic_text(text: str, lang: str) -> str:
        if lang == 'ar':
            reshaped_text = arabic_reshaper.reshape(text)
            bidi_text = get_display(reshaped_text)
            return bidi_text
        return text

    @staticmethod
    def generate_mall_performance_pdf(db: Session, lang: str = "en") -> bytes:
        font_path = "C:\\Windows\\Fonts\\arial.ttf"
        has_arabic_font = os.path.exists(font_path)
        
        if has_arabic_font:
            pdfmetrics.registerFont(TTFont('ArabicFont', font_path))
            font_name = 'ArabicFont'
        else:
            font_name = 'Helvetica'

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
        
        styles = getSampleStyleSheet()
        
        # Styles
        title_style = ParagraphStyle(
            'TitleStyle',
            parent=styles['Heading1'],
            fontName=font_name if lang == 'ar' else 'Helvetica-Bold',
            fontSize=24,
            textColor=colors.HexColor("#1e3a8a"), # Indigo-900
            spaceAfter=20,
            alignment=1 if lang == 'en' else 2 # Right align for Arabic
        )
        
        heading_style = ParagraphStyle(
            'HeadingStyle',
            parent=styles['Heading2'],
            fontName=font_name if lang == 'ar' else 'Helvetica-Bold',
            fontSize=16,
            textColor=colors.HexColor("#334155"), # Slate-700
            spaceBefore=20,
            spaceAfter=10,
            alignment=0 if lang == 'en' else 2
        )
        
        normal_style = styles['Normal']
        normal_style.fontName = font_name if lang == 'ar' else 'Helvetica'
        normal_style.fontSize = 11
        normal_style.textColor = colors.HexColor("#475569") # Slate-600
        normal_style.alignment = 0 if lang == 'en' else 2
        
        elements = []
        
        # Title
        title_text = "تقرير أداء سمارت مول" if lang == "ar" else "SmartMall AI OS Performance Report"
        elements.append(Paragraph(ReportService._prepare_arabic_text(title_text, lang), title_style))
        
        # Date
        date_str = datetime.now().strftime("%Y-%m-%d %H:%M")
        date_text = f"تاريخ التقرير: {date_str}" if lang == "ar" else f"Report Date: {date_str}"
        elements.append(Paragraph(ReportService._prepare_arabic_text(date_text, lang), normal_style))
        elements.append(Spacer(1, 20))
        
        # Collect Data
        total_shops = db.query(Shop).count()
        total_revenue = db.query(func.sum(Shop.daily_revenue)).scalar() or 0
        total_visitors = db.query(func.sum(Shop.visitor_count)).scalar() or 0
        
        active_alerts = db.query(Alert).filter(Alert.is_resolved == False).count()
        pending_tasks = db.query(Task).filter(Task.status == "pending").count()
        
        total_slots = db.query(ParkingSlot).count()
        occupied_slots = db.query(ParkingSlot).filter(ParkingSlot.is_occupied == True).count()
        occupancy_pct = (occupied_slots / total_slots * 100) if total_slots > 0 else 0
        
        # Executive Summary Section
        summary_title = "الملخص التنفيذي" if lang == "ar" else "Executive Summary"
        elements.append(Paragraph(ReportService._prepare_arabic_text(summary_title, lang), heading_style))
        
        # Table
        if lang == "ar":
            kpi_data = [
                [ReportService._prepare_arabic_text("القيمة", lang), ReportService._prepare_arabic_text("المؤشر", lang)],
                [str(total_shops), ReportService._prepare_arabic_text("إجمالي المحلات", lang)],
                [ReportService._prepare_arabic_text(f"{total_revenue:,.0f} EGP", lang), ReportService._prepare_arabic_text("الإيراد اليومي", lang)],
                [f"{total_visitors:,}", ReportService._prepare_arabic_text("الزوار اليوم", lang)],
                [str(active_alerts), ReportService._prepare_arabic_text("التنبيهات النشطة", lang)],
                [str(pending_tasks), ReportService._prepare_arabic_text("المهام المعلقة", lang)],
                [f"{occupancy_pct:.1f}%", ReportService._prepare_arabic_text("إشغال المواقف", lang)]
            ]
            col_widths = [150, 200]
        else:
            kpi_data = [
                ["Metric", "Value"],
                ["Total Shops", str(total_shops)],
                ["Daily Revenue", f"EGP {total_revenue:,.0f}"],
                ["Today's Visitors", f"{total_visitors:,}"],
                ["Active Alerts", str(active_alerts)],
                ["Pending Tasks", str(pending_tasks)],
                ["Parking Occupancy", f"{occupancy_pct:.1f}%"]
            ]
            col_widths = [200, 150]
            
        kpi_table = Table(kpi_data, colWidths=col_widths)
        
        align_right = 'RIGHT' if lang == 'ar' else 'LEFT'
        
        kpi_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#f1f5f9")), # Slate-100
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor("#0f172a")), # Slate-900
            ('ALIGN', (0, 0), (-1, -1), align_right),
            ('FONTNAME', (0, 0), (-1, 0), font_name if lang == 'ar' else 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.white),
            ('TEXTCOLOR', (0, 1), (-1, -1), colors.HexColor("#334155")),
            ('ALIGN', (0, 1), (-1, -1), align_right),
            ('FONTNAME', (0, 1), (-1, -1), font_name if lang == 'ar' else 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 10),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor("#e2e8f0")), # Slate-200
            ('PADDING', (0, 0), (-1, -1), 8),
        ]))
        
        elements.append(kpi_table)
        elements.append(Spacer(1, 30))
        
        # Operational Insights Section
        ops_title = "تحليل العمليات (AI Insight)" if lang == "ar" else "AI Operational Insights"
        elements.append(Paragraph(ReportService._prepare_arabic_text(ops_title, lang), heading_style))
        
        if active_alerts > 0:
            msg = "توجد تنبيهات أمنية وتشغيلية تحتاج إلى تدخل مباشر لضمان استقرار العمليات." if lang == "ar" else "There are active security and operational alerts requiring immediate attention."
            elements.append(Paragraph(f"• {ReportService._prepare_arabic_text(msg, lang)}", normal_style))
            
        if occupancy_pct > 80:
            msg = "إشغال المواقف مرتفع، يُنصح بتفعيل توجيه السيارات الذكي." if lang == "ar" else "Parking occupancy is high. Intelligent routing is recommended."
            elements.append(Paragraph(f"• {ReportService._prepare_arabic_text(msg, lang)}", normal_style))
        else:
            msg = "إشغال المواقف ضمن المعدلات الطبيعية." if lang == "ar" else "Parking occupancy is within normal levels."
            elements.append(Paragraph(f"• {ReportService._prepare_arabic_text(msg, lang)}", normal_style))
            
        elements.append(Spacer(1, 10))
        msg = "تم استخراج هذا التقرير آلياً عبر نظام سمارت مول التشغيلي المعتمد على الذكاء الاصطناعي." if lang == "ar" else "This report was automatically generated by the SmartMall AI OS."
        elements.append(Paragraph(ReportService._prepare_arabic_text(msg, lang), normal_style))

        # Build PDF
        doc.build(elements)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        
        return pdf_bytes
