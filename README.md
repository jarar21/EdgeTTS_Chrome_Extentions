# EdgeTTS Chrome Extension

Overview

This Chrome extension allows you to use Microsoft's Edge Text-to-Speech (EdgeTTS) locally via a Flask server. You can generate audio for custom text or the content of any webpage with ease.

Features

Generate audio from user-provided text.

Generate audio for the content of the current webpage.

Installation

Set up the Flask server:

Ensure Python is installed.

Install dependencies using:

pip install -r requirements.txt

Run the Flask server:

python server.py

Add the extension to Chrome:

Open Chrome and navigate to chrome://extensions/.

Enable "Developer mode" in the top-right corner.

Click "Load unpacked" and select the extension folder.

Usage

Open the extension popup and enter text to generate audio.

Alternatively, use the "Generate Audio for Webpage" option to convert webpage content into audio.

Contributing

Feel free to fork the repository, make changes, and submit a pull request. Suggestions and improvements are always welcome!
