.PHONY: setup check audit secret-scan verify gate
.NOTPARALLEL:

setup:
	npm ci
	npm run setup

check audit secret-scan verify gate:
	npm run $@
