@echo off
REM Change directory to where your Flask app and virtual environment are located
cd /d J:\tts

REM Activate the virtual environment
call flask_env\Scripts\activate

REM Start the Flask app
python app.py

REM Keep the terminal open if there is an error
pause
