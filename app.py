from flask import Flask, render_template, request, jsonify, send_file
import os
import cv2
import numpy as np
import pytesseract
import sqlite3
import pandas as pd
from datetime import datetime

app = Flask(__name__)

# Database initialization
def init_db():
    conn = sqlite3.connect('business_cards.db')
    c = conn.cursor()
    
    # Drop existing table if it exists
    c.execute('DROP TABLE IF EXISTS cards')
    conn.commit()
    
    # Create new table with updated schema
    c.execute('''CREATE TABLE cards
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  full_name TEXT,
                  email TEXT,
                  phone TEXT,
                  company TEXT,
                  designation TEXT,
                  address TEXT,
                  website TEXT,
                  raw_text TEXT,
                  image_path TEXT,
                  created_at TIMESTAMP)''')
    conn.commit()
    conn.close()

def detect_card(image):
    # Convert to grayscale
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    # Apply threshold
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    # Find contours
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    # Find the largest contour (assumed to be the business card)
    if contours:
        largest_contour = max(contours, key=cv2.contourArea)
        return cv2.boundingRect(largest_contour)
    return None

def parse_business_card(text):
    # Initialize dictionary for storing extracted information
    info = {
        'full_name': '',
        'email': '',
        'phone': '',
        'company': '',
        'designation': '',
        'address': '',
        'website': ''
    }
    
    lines = text.split('\n')
    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        # Extract email
        if '@' in line and '.' in line and not info['email']:
            info['email'] = line.lower()
            continue
            
        # Extract phone number (simple pattern)
        if any(c.isdigit() for c in line) and not info['phone']:
            # Keep only digits and common phone number characters
            phone = ''.join(c for c in line if c.isdigit() or c in '+-.()')
            if len(phone) >= 6:  # Assuming minimum phone length
                info['phone'] = phone
                continue
                
        # Extract website
        if any(x in line.lower() for x in ['www.', 'http', '.com', '.org', '.net']) and not info['website']:
            info['website'] = line
            continue
            
        # Try to identify designation (usually comes with specific keywords)
        if any(x in line.lower() for x in ['manager', 'director', 'ceo', 'officer', 'engineer', 'developer']):
            info['designation'] = line
            continue
            
        # If we haven't found a name yet and this line is short, it might be a name
        if not info['full_name'] and len(line.split()) <= 4:
            info['full_name'] = line
            continue
            
        # If we haven't found a company yet, and it's not any of the above, it might be a company
        if not info['company']:
            info['company'] = line
            
    # Remaining lines might be address
    if not info['address']:
        # Find longest remaining line that's not already categorized
        remaining_lines = [line for line in lines if line.strip() and 
                         line != info['full_name'] and
                         line != info['email'] and
                         line != info['phone'] and
                         line != info['company'] and
                         line != info['designation'] and
                         line != info['website']]
        if remaining_lines:
            info['address'] = ' '.join(remaining_lines)
    
    return info

def extract_text(image):
    # Use Tesseract to extract text
    text = pytesseract.image_to_string(image)
    # Parse the extracted text
    info = parse_business_card(text)
    return text, info

@app.route('/')
def index():
    # Get all cards from database
    conn = sqlite3.connect('business_cards.db')
    c = conn.cursor()
    c.execute("""
        SELECT id, full_name, email, phone, company, designation, 
               address, website, image_path, created_at 
        FROM cards ORDER BY created_at DESC
    """)
    cards = c.fetchall()
    conn.close()
    
    # Convert to list of dictionaries
    cards_list = [
        {
            'id': row[0],
            'full_name': row[1],
            'email': row[2],
            'phone': row[3],
            'company': row[4],
            'designation': row[5],
            'address': row[6],
            'website': row[7],
            'image_path': row[8],
            'created_at': row[9]
        }
        for row in cards
    ]
    
    return render_template('index.html', cards=cards_list)

@app.route('/upload', methods=['POST'])
def upload():
    if 'image' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['image']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    # Save the uploaded image
    filename = f"card_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
    filepath = os.path.join('static', filename)
    file.save(filepath)
    
    # Process the image
    image = cv2.imread(filepath)
    card_rect = detect_card(image)
    
    if card_rect:
        x, y, w, h = card_rect
        card_image = image[y:y+h, x:x+w]
        # Save the cropped image
        cropped_filepath = os.path.join('static', f'cropped_{filename}')
        cv2.imwrite(cropped_filepath, card_image)
        
        # Extract text and parse information
        raw_text, info = extract_text(card_image)
        
        # Save to database
        conn = sqlite3.connect('business_cards.db')
        c = conn.cursor()
        c.execute("""
            INSERT INTO cards (
                full_name, email, phone, company, designation, 
                address, website, raw_text, image_path, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            info['full_name'], info['email'], info['phone'], 
            info['company'], info['designation'], info['address'], 
            info['website'], raw_text, cropped_filepath, datetime.now()
        ))
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'filepath': cropped_filepath,
            'text': raw_text,
            'parsed_info': info
        })
    
    return jsonify({'error': 'No business card detected'}), 400

@app.route('/export-csv')
def export_csv():
    conn = sqlite3.connect('business_cards.db')
    df = pd.read_sql_query("SELECT * FROM cards", conn)
    conn.close()
    
    csv_path = os.path.join('static', 'business_cards_export.csv')
    df.to_csv(csv_path, index=False)
    return send_file(csv_path, as_attachment=True, download_name='business_cards.csv')

if __name__ == '__main__':
    init_db()
    app.run(debug=True)
