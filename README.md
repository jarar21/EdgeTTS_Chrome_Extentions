# EdgeTTS Chrome Extension

The **EdgeTTS Chrome Extension** is a versatile tool that uses a locally hosted Flask server to generate audio using EdgeTTS. This extension provides a seamless way to convert webpage content or custom text into speech, enhancing accessibility and user experience.

---

## Features

- **Seamless Paragraph Audio**: Click on any paragraph on a webpage, and the extension will convert it to audio. It will continue generating audio for subsequent paragraphs, ensuring a smooth and uninterrupted listening experience.
- **Webpage-to-Audio Conversion**: Extracts text from the active webpage and converts it into speech with just a click.
- **Custom Text-to-Speech**: Input custom text and dynamically generate audio on demand.
- **Interactive Widget**: Includes playback controls, speed adjustments, and widget customization options (minimize, maximize, drag).
- **Custom Audio Player**: Features an integrated audio player built with wavesurfer.js for enhanced playback functionality.

---
---
### Collapsed popup
![2025-02-25 19_42_38-Genghis Khan - Wikipedia](https://github.com/user-attachments/assets/a61f0890-fb8f-4bb4-909a-e0c9adea48ff)


### Expanded popup
![2025-02-25 19_43_05-Genghis Khan - Wikipedia](https://github.com/user-attachments/assets/8775cc10-e7b4-402c-8d7e-8c1a2ae589e0)

### Seamless Paragraph Audio
![2025-02-27 21_44_06-Genghis Khan - Wikipedia](https://github.com/user-attachments/assets/2c7d1805-83e8-470a-b882-8eae8fc9f219)


### Widget Generate 
![2025-02-25 19_45_07-Genghis Khan - Wikipedia](https://github.com/user-attachments/assets/23bde791-63c8-43bd-82fd-d791413f37d1)

### Widget Whole page
![2025-02-25 19_58_59-Custom TTS Audio Player](https://github.com/user-attachments/assets/9c3d7638-ea08-448b-b105-9d0323476aee)



### Requirements
Ensure you have the following installed:
- Python 3.x
- Flask

Install dependencies using `requirements.txt`:
pip install -r requirements.txt

### Installation

1. Clone the repository:
```bash
git clone https://github.com/jarar21/EdgeTTS_Chrome_Extentions.git
```
3. Start the Flask server:
```bash
python app.py
```
5. Load the extension into Chrome:
- Open Chrome and navigate to `chrome://extensions/`.
- Enable **Developer Mode** (top-right corner).
- Click **Load unpacked** and select the cloned folder.

---

### Usage

1. Open the widget by clicking on the extension icon in Chrome.
2. Use the **Listen Tab** to generate and play audio for webpage content.
3. Use the **Generate Tab** to input custom text and generate audio.

---

### License

This project is licensed under the MIT License.
