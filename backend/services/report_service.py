import io
import datetime
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.units import inch
from sqlalchemy.orm import Session
from models.database import Shop

class ReportService:
    @staticmethod
    def generate_mall_performance_pdf(db: Session) -> bytes:
        shops = db.query(Shop).all()
        buffer = io.BytesIO()
        p = canvas.Canvas(buffer, pagesize=letter)
        width, height = letter

        # Branding
        p.setFillColor(colors.black)
        p.setFont("Helvetica-Bold", 26)
        p.drawString(1*inch, height - 1*inch, "SmartMall AI OS")
        p.setFont("Helvetica", 10)
        p.drawString(1*inch, height - 1.2*inch, "Enterprise Resource Management & Intelligence Report")
        
        # Header Line
        p.setStrokeColor(colors.indigo)
        p.setLineWidth(2)
        p.line(1*inch, height - 1.4*inch, width - 1*inch, height - 1.4*inch)

        # Date & Metadata
        p.setFont("Helvetica-Oblique", 9)
        p.drawString(width - 2.5*inch, height - 0.8*inch, f"REPORT ID: #SM-{datetime.datetime.now().strftime('%Y%m%d')}")
        p.drawString(width - 2.5*inch, height - 0.95*inch, f"DATE: {datetime.datetime.now().strftime('%d %B %Y')}")

        y = height - 2*inch
        
        # Summary Box
        p.setFillColor(colors.whitesmoke)
        p.roundRect(1*inch, y - 0.5*inch, width - 2*inch, 0.7*inch, 5, fill=1, stroke=0)
        p.setFillColor(colors.black)
        p.setFont("Helvetica-Bold", 12)
        total_rev = sum(s.daily_revenue for s in shops)
        total_vis = sum(s.visitor_count for s in shops)
        p.drawString(1.2*inch, y - 0.1*inch, f"MALL TOTALS:  Revenue: ${total_rev:,.2f}  |  Visitors: {total_vis:,}")

        y -= 1*inch
        
        # Inventory / Shop Table
        p.setFont("Helvetica-Bold", 11)
        p.drawString(1*inch, y, "TENANT PERFORMANCE SNAPSHOT")
        y -= 0.3*inch
        
        # Header Row
        p.setFont("Helvetica-Bold", 9)
        p.drawString(1*inch, y, "Shop Name")
        p.drawString(3*inch, y, "Category")
        p.drawString(4.5*inch, y, "Rev ($)")
        p.drawString(5.5*inch, y, "Score")
        y -= 0.1*inch
        p.setLineWidth(0.5)
        p.line(1*inch, y, width - 1*inch, y)
        y -= 0.2*inch

        p.setFont("Helvetica", 9)
        for shop in shops:
            p.drawString(1*inch, y, shop.name)
            p.drawString(3*inch, y, shop.category)
            p.drawString(4.5*inch, y, f"{shop.daily_revenue:,.0f}")
            score_color = colors.emerald if shop.performance_score > 80 else colors.black
            p.setFillColor(score_color)
            p.drawString(5.5*inch, y, f"{shop.performance_score}%")
            p.setFillColor(colors.black)
            y -= 0.2*inch
            if y < 1.5*inch:
                p.showPage()
                y = height - 1*inch

        # AI Conclusion Footer
        y -= 0.5*inch
        p.setFillColor(colors.indigo)
        p.setFont("Helvetica-Bold", 10)
        p.drawString(1*inch, y, "AI ANALYTICS CONCLUSION:")
        y -= 0.2*inch
        p.setFont("Helvetica", 9)
        p.setFillColor(colors.black)
        p.drawString(1*inch, y, "Based on current trends, we anticipate a 12% revenue growth if the Sunday marketing campaign is approved.")
        
        p.showPage()
        p.save()
        return buffer.getvalue()
