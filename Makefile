
initenv:
	@echo "Creating ENV template..."
	@if [ ! -e ./ENV.sh ]; then \
	  cp ENVTEMPLATE.sh ENV.sh; \
	  echo "ENV.sh created, edit it to configure CycleDash."; \
	else \
	  echo "ENV.sh already exists, leaving it alone."; \
	fi


.PHONY: initenv
