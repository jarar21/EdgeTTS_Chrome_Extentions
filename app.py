from flask import Flask, request, jsonify, send_file, render_template
from flask_cors import CORS  # Import Flask-CORS
import asyncio
from edge_tts import Communicate


app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Route to serve the test HTML file
@app.route('/test-blob-audio')
def test_blob_audio():
    return render_template('test_blob_audio.html')  # Render the test HTML file

# TTS API route
@app.route('/api/tts', methods=['POST'])
def tts_api():
    data = request.json  # Get JSON data from POST request
    text = data.get('text')
    voice = data.get('voice', 'en-US-AvaNeural')  # Default voice
    rate = data.get('rate', 0)
    pitch = data.get('pitch', 0)

    if not text:
        return jsonify({"error": "Text is required"}), 400

    # Run the TTS function asynchronously
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        output_file, warning = loop.run_until_complete(text_to_speech(text, voice, rate, pitch))
        if warning:
            return jsonify({"warning": warning}), 400

        # Return the generated audio file as a Blob-like response
        return send_file(output_file, mimetype="audio/mpeg", as_attachment=False)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


async def text_to_speech(text, voice="en-US-AvaNeural", rate=0, pitch=0):
    """
    Converts text to speech using Edge-TTS.
    """
    try:
        communicate = Communicate(text, voice)
        output_file = "output_audio.mp3"
        await communicate.save(output_file)
        return output_file, None
    except Exception as e:
        return None, str(e)


if __name__ == '__main__':
    app.run(debug=True)
