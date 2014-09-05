cpnode:
	@echo "Copying node_modules to ./cycledash/static/lib..."
	if [ ! -d ./cycledash/static/lib ]; then mkdir -v ./cycledash/static/lib; fi
	cp -R ./node_modules/ ./cycledash/static/lib

initenv:
	@echo "Creating ENV template..."
	@if [ ! -e ./ENV ]; then \
	  cp ENVTEMPLATE ENV; \
	  echo "ENV created, edit it to configure CycleDash."; \
	else \
	  echo "ENV already exists, leaving it alone."; \
	fi


.PHONY: npnode initenv
