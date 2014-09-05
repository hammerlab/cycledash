all: copynode initenv

copynode:
	@echo "Copying node_modules to ./cycledash/static/lib..."
	if [ ! -d ./cycledash/static/lib ]; then mkdir -v ./cycledash/static/lib; fi
	cp -R ./node_modules/ ./cycledash/static/lib

initenv:
	@touch ./ENV
	@echo "\nBe sure to source ./ENV (and configure ENV VARS within).\n"
