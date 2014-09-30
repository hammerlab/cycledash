from cycledash import app


if __name__ == '__main__':
    app.run(debug=False,
            use_reloader=app.config['USE_RELOADER'],
            port=app.config['PORT'],
            host='0.0.0.0')
