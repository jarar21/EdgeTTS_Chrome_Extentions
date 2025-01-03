# EdgeTTS Chrome Extension

The **EdgeTTS Chrome Extension** is a tool that leverages a Flask server running locally to generate audio using EdgeTTS. The extension allows users to:
- Generate audio from custom text input.
- Generate and play audio for the content of the current webpage.

### Features
- **Webpage Audio**: Extracts text from the active webpage and converts it into speech.
- **Custom Text-to-Speech**: Allows users to input text and generate audio dynamically.
- **Interactive Widget**: Includes playback controls, speed adjustments, and widget customization (minimize, maximize, drag).

---
### Popup 
![2025-01-03 08_31_55-Salary negotiation_ get paid what you're worth - by Better Money Habits® (articl](https://github.com/user-attachments/assets/b35b365d-08bc-42c4-a104-6235a429d05a)

### Widget
![2025-01-03 08_32_56-Arts and humanities _ Khan Academy](https://github.com/user-attachments/assets/c1284c15-0d09-42eb-93d9-86008f9a28d2)


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
