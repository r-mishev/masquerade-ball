import os
import threading
import smtplib
import random
from datetime import datetime
from io import BytesIO
from email.mime.image import MIMEImage
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient, ReturnDocument
from PIL import Image, ImageDraw, ImageFont
import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app) # Enable Cross-Origin requests for React

# --- CONFIGURATION ---
MONGO_URI = os.getenv("MONGO_URI")
GMAIL_EMAIL = os.getenv("GMAIL_EMAIL")
GMAIL_PASSWORD = os.getenv("GMAIL_APP_PASSWORD")
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Connect to DB
try:
    client = MongoClient(MONGO_URI)
    db = client['masquerade_ball_2025']
    users_col = db['users']
    donations_col = db['donations']
    print("✅ MongoDB Connected")
except Exception as e:
    print(f"❌ DB Connection Error: {e}")

# --- HELPER FUNCTIONS (Adapted from your script) ---

def generate_certificate_image(name, amount):
    """
    Generates the certificate in memory using PIL.
    Returns a BytesIO object (buffer) of the PNG.
    """
    try:
        # Path to assets
        template_path = os.path.join(BASE_DIR, 'assets', 'cert.png') # Make sure filename matches
        
        # Load Image
        img = Image.open(template_path).convert("RGB")
        draw = ImageDraw.Draw(img)
        W, H = img.size

        # --- FONT CONFIGURATION ---
        # Try to load a nice font, or fallback to default
        font_path = os.path.join(BASE_DIR, 'assets', 'font.ttf') 
        try:
            # Adjust size relative to image height (approx 2.5% of height for Name)
            name_font_size = int(H * 0.035) 
            amount_font_size = int(H * 0.035)
            
            font_name = ImageFont.truetype(font_path, name_font_size)
            font_amount = ImageFont.truetype(font_path, amount_font_size)
        except:
            font_name = ImageFont.load_default()
            font_amount = ImageFont.load_default()

        # --- 1. PLACE DONOR NAME ---
        # Visual Location: In the space between the top divider and "HAS DONATED"
        # This is approximately at 44% of the image height
        name_y_position = H * 0.44
        
        # Calculate text width to center it perfectly
        _, _, w_name, h_name = draw.textbbox((0, 0), name, font=font_name)
        draw.text(
            ((W - w_name) / 2, name_y_position), 
            name, 
            font=font_name, 
            fill="white" # Changed to white to stand out against dark background
        )

        # --- 2. PLACE AMOUNT ---
        # Visual Location: Between "HAS DONATED" and "TO OPERATION..."
        # This is approximately at 58% of the image height
        amount_y_position = H * 0.58
        
        amount_str = f"${amount:.2f}"
        _, _, w_amt, h_amt = draw.textbbox((0, 0), amount_str, font=font_amount)
        draw.text(
            ((W - w_amt) / 2, amount_y_position), 
            amount_str, 
            font=font_amount, 
            fill="#d4af37"
        )

        # Save to buffer
        buf = BytesIO()
        img.save(buf, format='PNG')
        buf.seek(0)
        return buf
        
    except Exception as e:
        print(f"Image Gen Error: {e}")
        return None

def send_email_background(recipient_email, recipient_name, amount, cert_buffer):
    """Sends email using smtplib with Port 587 (TLS)"""
    try:
        msg = MIMEMultipart()
        msg['Subject'] = "🎄 Thank You for Your Christmas Donation! 🎄"
        msg['From'] = GMAIL_EMAIL
        msg['To'] = recipient_email

        body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
            <h3>Dear {recipient_name},</h2>
            <p>Thank you for your generous donation of <strong>${amount:.2f}</strong>.</p>
            <p>Attached is your personalized Certificate of Donation along with our heartfelt wishes for a Merry Christmas!</p>
            <p>Warm regards,<br/>The Student Government</p>
        </body>
        </html>
        """
        msg.attach(MIMEText(body, 'HTML'))

        # Attach Image
        if cert_buffer:
            img = MIMEImage(cert_buffer.read())
            img.add_header('Content-Disposition', 'attachment', filename="Certificate.png")
            msg.attach(img)

        smtp_server = "smtp.gmail.com"
        smtp_port = 587
        
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.ehlo()       # Identify ourselves
            server.starttls()   # Encrypt the connection
            server.ehlo()       # Re-identify as encrypted
            
            server.login(GMAIL_EMAIL, GMAIL_PASSWORD)
            server.sendmail(GMAIL_EMAIL, recipient_email, msg.as_string())
        
        print(f"📧 Email sent to {recipient_email}")

    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"❌ Email Error: {e}")

# --- API ROUTES ---

@app.route('/')
def home():
    return "Masquerade Ball API is Running (Python)"

@app.route('/seed-users', methods=['GET'])
def seed_users():
    # Clear and re-seed users
    users_col.delete_many({})
    users = [
        { "loginCode": 'maa230', "isAdmin": True },
        { "loginCode": 'rmm220', "isAdmin": True },
        { "loginCode": 'lsh230', "isAdmin": True },
        { "loginCode": 'jmk240', "isAdmin": True },
        { "loginCode": 'nso220', "isAdmin": False },
        { "loginCode": 'pnz220', "isAdmin": False },
        { "loginCode": 'stt230', "isAdmin": False },
        { "loginCode": 'nmp230', "isAdmin": False },
        { "loginCode": 'ena230', "isAdmin": False },
        { "loginCode": 'kns231', "isAdmin": False },
        { "loginCode": 'ksd240', "isAdmin": False },
        { "loginCode": 'iaf240', "isAdmin": False },
        { "loginCode": 'hnm242', "isAdmin": False },
        { "loginCode": 'sat240', "isAdmin": False },
        { "loginCode": 'bgk250', "isAdmin": False },
        { "loginCode": 'olr250', "isAdmin": False },
    ]
    users_col.insert_many(users)
    return "Users seeded"

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    code = data.get('loginCode')
    user = users_col.find_one({"loginCode": code})
    
    if user:
        return jsonify({"loginCode": user['loginCode'], "isAdmin": user['isAdmin']})
    else:
        return jsonify({"message": "Invalid Code"}), 404

@app.route('/api/donate', methods=['POST'])
def donate():
    data = request.json
    try:
        amount = float(data['amount'])
        if amount < 10:
            return jsonify({"message": "Minimum amount is $10"}), 400
            
        new_donation = {
            "donorName": data['donorName'],
            "donorEmail": data['donorEmail'],
            "amount": amount,
            "enteredBy": data['enteredBy'],
            "timestamp": datetime.now()
        }
        
        # 1. Save to DB
        donations_col.insert_one(new_donation)

        # 2. Generate Cert & Email (In Background Thread to keep UI fast)
        cert_buffer = generate_certificate_image(data['donorName'], amount)
        
        thread = threading.Thread(target=send_email_background, args=(
            data['donorEmail'], 
            data['donorName'], 
            amount, 
            cert_buffer
        ))
        thread.start()

        return jsonify({"message": "Donation logged successfully"}), 201

    except Exception as e:
        print(e)
        return jsonify({"message": "Server Error"}), 500

@app.route('/api/admin/stats', methods=['GET'])
def stats():
    try:
        # Aggregate Totals
        pipeline_grand = [{"$group": {"_id": None, "total": {"$sum": "$amount"}}}]
        grand_res = list(donations_col.aggregate(pipeline_grand))
        grand_total = grand_res[0]['total'] if grand_res else 0

        # Today's Total
        start_of_day = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        pipeline_today = [
            {"$match": {"timestamp": {"$gte": start_of_day}}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]
        today_res = list(donations_col.aggregate(pipeline_today))
        today_total = today_res[0]['total'] if today_res else 0

        return jsonify({"grandTotal": grand_total, "todaysTotal": today_total})
    except Exception as e:
        print(e)
        return jsonify({"message": "Error fetching stats"}), 500

@app.route('/api/admin/draw-raffle', methods=['GET'])
def draw_raffle():
    # Fetch all donations
    all_donations = list(donations_col.find({}))
    entries_map = {} # email -> count
    name_map = {} # email -> name

    for d in all_donations:
        amt = d['amount']
        points = 0
        if amt >= 50: points = 15
        elif amt >= 20: points = 5
        elif amt >= 15: points = 3
        elif amt >= 10: points = 1
        
        email = d['donorEmail']
        entries_map[email] = entries_map.get(email, 0) + points
        name_map[email] = d['donorName']

    # Create Pool
    pool = []
    for email, count in entries_map.items():
        pool.extend([email] * count)

    if not pool:
        return jsonify({"message": "No entries found"}), 400

    winner_email = random.choice(pool)
    
    return jsonify({
        "winnerName": name_map[winner_email],
        "winnerEmail": winner_email,
        "totalEntries": entries_map[winner_email]
    })

if __name__ == '__main__':
    # Running locally
    app.run(host='0.0.0.0', port=int(os.getenv("PORT", 5000)), debug=True)