SHELL := /bin/zsh
.DEFAULT_GOAL := update-version

NODE_BIN := $(shell command -v node 2>/dev/null)
PNPM_BIN := $(shell command -v pnpm 2>/dev/null)
NPM_BIN := $(shell command -v npm 2>/dev/null)
PKG_BIN := $(if $(strip $(PNPM_BIN)),$(PNPM_BIN),$(NPM_BIN))
PKG_NAME := $(if $(strip $(PNPM_BIN)),pnpm,npm)

ifeq ($(origin VERSION), undefined)
ifneq ($(strip $(NODE_BIN)),)
VERSION := $(shell "$(NODE_BIN)" -e "\
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));\
  const y = String(d.getFullYear()).slice(-2);\
  const m = d.getMonth() + 1;\
  const day = d.getDate();\
  const h = String(d.getHours()).padStart(2, '0');\
  const mn = String(d.getMinutes()).padStart(2, '0');\
  console.log(y + '.' + m + day + '.' + h + mn);\
")
endif
endif

.PHONY: help ensure-node print-version update-version dev deploy

help:
	@echo "Available targets:"
	@echo "  make                Update package version with Asia/Shanghai timestamp"
	@echo "  make help           Show this help message"
	@echo "  make ensure-node    Check whether Node.js and pnpm/npm are installed"
	@echo "  make print-version  Print the computed release version"
	@echo "  make update-version Update package.json version"
	@echo "  make dev            Start the Vite dev server with $(PKG_NAME)"
	@echo "  make deploy         Build and typecheck release artifacts"

ensure-node:
	@if [ -z "$(NODE_BIN)" ]; then \
		echo "node is not installed. Please install Node.js first."; \
		exit 1; \
	fi
	@if [ -z "$(PKG_BIN)" ]; then \
		echo "pnpm or npm is not installed. Please install pnpm first, or use npm as a fallback."; \
		exit 1; \
	fi

print-version: ensure-node
	@echo "$(VERSION)"

update-version: ensure-node
	@VERSION="$(VERSION)" "$(NODE_BIN)" -e "\
const fs = require('fs');\
const file = 'package.json';\
const version = process.env.VERSION;\
const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));\
pkg.version = version;\
fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');\
"
	@echo "Updated version to $(VERSION)"

dev: ensure-node
	@"$(PKG_BIN)" run dev

deploy: update-version
	@"$(PKG_BIN)" run build
	@"$(PKG_BIN)" run typecheck
	@echo "Deploy artifacts are ready in dist/. Commit and push when you want to publish them."
