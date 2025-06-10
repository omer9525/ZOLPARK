from flask import Flask, render_template
from flask_cors import CORS
import webbrowser
import threading

app = Flask(__name__)
CORS(app)


@app.route('/open-gate')
def open_gate():
    threading.Thread(target=lambda: webbrowser.open('http://localhost:5000/gate')).start()
    return 'השער נפתח!'


@app.route('/close-gate')
def close_gate():
    threading.Thread(target=lambda: webbrowser.open('http://localhost:5000/gate-closed')).start()
    return 'השער נסגר!'


@app.route('/gate')
def gate():
    return '''
    <html>
      <head>
        <title>השער נפתח</title>
        <style>
          body { margin: 0; background: black; display: flex; align-items: center; justify-content: center; height: 100vh; }
          img { width: 80vw; height: auto; }
        </style>
      </head>
      <body>
        <img src="https://media.giphy.com/media/d2Z9QYzA2aidiWn6/giphy.gif" alt="Opening gate">
      </body>
    </html>
    '''


@app.route('/gate-closed')
def gate_closed():
    return '''
    <html>
      <head>
        <title>השער נסגר</title>
        <style>
          body { margin: 0; background: black; display: flex; align-items: center; justify-content: center; height: 100vh; }
          img { width: 80vw; height: auto; }
        </style>
      </head>
      <body>
        <img src="https://media.giphy.com/media/3oz8xIsloV7zOmt81G/giphy.gif" alt="Sad person left alone">
      </body>
    </html>
    '''


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)

