# EdgeTTS Chrome Extension

The **EdgeTTS Chrome Extension** is a tool that leverages a Flask server running locally to generate audio using EdgeTTS. The extension allows users to:
- Generate audio from custom text input.
- Generate and play audio for the content of the current webpage.

### Features
- **Webpage Audio**: Extracts text from the active webpage and converts it into speech.
- **Custom Text-to-Speech**: Allows users to input text and generate audio dynamically.
- **Interactive Widget**: Includes playback controls, speed adjustments, and widget customization (minimize, maximize, drag).

---
### Collapsed popup
![2025-02-25 19_42_38-Genghis Khan - Wikipedia](https://github.com/user-attachments/assets/a61f0890-fb8f-4bb4-909a-e0c9adea48ff)


### Expanded popup
![2025-02-25 19_43_05-Genghis Khan - Wikipedia](https://github.com/user-attachments/assets/8775cc10-e7b4-402c-8d7e-8c1a2ae589e0)


### Widget Generate 
![2025-02-25 19_45_07-Genghis Khan - Wikipedia](https://github.com/user-attachments/assets/23bde791-63c8-43bd-82fd-d791413f37d1)

### Widget Whole page
![2025-02-25 19_43_25-Genghis Khan - Wikipedia](https://github.com/user-attachments/assets/b2ec0845-2d7a-4576-b216-c9f51ffcd07f)


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
