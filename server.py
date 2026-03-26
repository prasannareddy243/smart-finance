from flask import Flask, request, jsonify
from flask_cors import CORS
import pywhatkit as kit
import time
import threading

app = Flask(__name__)
# Enable CORS so the React app running on port 3000 can talk to this API on port 5000
CORS(app)

def send_whatsapp_async(phone_number, message):
    """
    Sends a WhatsApp message using PyWhatKit.
    Since pywhatkit blocks the thread with time.sleep internally,
    we run it in a background thread to return a quick 200 OK to the frontend.
    """
    try:
        # We need to make sure the number has the country code
        if not phone_number.startswith('+'):
            phone_number = "+" + phone_number
        
        print(f"Opening WhatsApp Web to send message to {phone_number}...")
        # sendwhatmsg_instantly takes: 
        # phone_num, message, wait_time (seconds to wait for WA Web to load), tab_close (bool), close_time (seconds)
        kit.sendwhatmsg_instantly(
            phone_no=phone_number, 
            message=message, 
            wait_time=15, 
            tab_close=True, 
            close_time=5
        )
        print("Message dispatched to PyWhatKit.")
    except Exception as e:
        print(f"Error sending WhatsApp message: {str(e)}")

@app.route('/send-reminder', methods=['POST'])
def send_reminder():
    data = request.json
    phone = data.get('phone')
    message = data.get('message')
    amount = data.get('amount')
    upi_id = data.get('upiId', '9704314413-2@ybl')
    b_name = "Shaik uddandu bee"
    
    if not phone or not message:
        return jsonify({"error": "Phone and message required"}), 400
        
    try:
        import urllib.request
        import urllib.parse
        import os
        import time

        if amount:
            # Generate QR Code image url tailored to exact interest amount
            encoded_name = urllib.parse.quote(b_name)
            upi_link = f"upi://pay?pa={upi_id}&pn={encoded_name}&am={amount}&cu=INR"
            qr_url = f"https://api.qrserver.com/v1/create-qr-code/?size=350x350&data={urllib.parse.quote(upi_link)}&color=000000&bgcolor=ffffff"
            
            # Save image locally
            temp_path = os.path.join(os.getcwd(), 'temp_qr.png')
            urllib.request.urlretrieve(qr_url, temp_path)
            
            print(f"Sending image to {phone}")
            # wait_time=15 is default, tab_close=True closes it after sending to prevent clutter
            kit.sendwhats_image(phone, temp_path, caption=message, wait_time=15, tab_close=True, close_time=3)
            time.sleep(2)
            
            # Clean up the image after queuing it to browser
            if os.path.exists(temp_path):
                try:
                    os.remove(temp_path)
                except:
                    pass
        else:
            print(f"Sending text to {phone}")
            kit.sendwhatmsg_instantly(phone, message, 15, True, 3)
            
        return jsonify({"status": "success"})
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print("Starting SmartFinance Automated Messaging Server...")
    print("Make sure your default browser is logged into WhatsApp Web!")
    app.run(port=5000, debug=True)
