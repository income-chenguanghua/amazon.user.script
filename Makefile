SHELL := /bin/zsh
.DEFAULT_GOAL := update-version

NODE_BIN := $(shell command -v node 2>/dev/null)
PNPM_BIN := $(shell command -v pnpm 2>/dev/null)
NPM_BIN := $(shell command -v npm 2>/dev/null)
PKG_BIN := $(if $(strip $(PNPM_BIN)),$(PNPM_BIN),$(NPM_BIN))
PKG_NAME := $(if $(strip $(PNPM_BIN)),pnpm,npm)
GIT_BIN := $(shell command -v git 2>/dev/null)
CURL_BIN := $(shell command -v curl 2>/dev/null)
REPO_SLUG := income-chenguanghua/amazon.user.script
CDN_BASE := https://cdn.jsdelivr.net/gh/$(REPO_SLUG)
PURGE_BASE := https://purge.jsdelivr.net/gh/$(REPO_SLUG)
CDN_FILES := dist/amazon.meta.js dist/amazon.user.js
COMMIT_MSG ?= bump version

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

.PHONY: help ensure-node ensure-git ensure-curl print-version update-version dev deploy print-cdn purge-cdn

help:
	@echo "Available targets:"
	@echo "  make                Update package version with Asia/Shanghai timestamp"
	@echo "  make help           Show this help message"
	@echo "  make ensure-node    Check whether Node.js and pnpm/npm are installed"
	@echo "  make ensure-git     Check whether git is installed"
	@echo "  make ensure-curl    Check whether curl is installed"
	@echo "  make print-version  Print the computed release version"
	@echo "  make update-version Update package.json version"
	@echo "  make dev            Start the Vite dev server with $(PKG_NAME)"
	@echo "  make deploy         Version, build, typecheck, commit, push, then purge jsDelivr"
	@echo "  make print-cdn      Print jsDelivr install and purge URLs"
	@echo "  make purge-cdn      Purge jsDelivr cache for dist artifacts after git push"

ensure-node:
	@if [ -z "$(NODE_BIN)" ]; then \
		echo "node is not installed. Please install Node.js first."; \
		exit 1; \
	fi
	@if [ -z "$(PKG_BIN)" ]; then \
		echo "pnpm or npm is not installed. Please install pnpm first, or use npm as a fallback."; \
		exit 1; \
	fi

ensure-git:
	@if [ -z "$(GIT_BIN)" ]; then \
		echo "git is not installed. Please install git first."; \
		exit 1; \
	fi

ensure-curl:
	@if [ -z "$(CURL_BIN)" ]; then \
		echo "curl is not installed. Please install curl first."; \
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

deploy: update-version ensure-git ensure-curl
	@"$(PKG_BIN)" run build
	@"$(PKG_BIN)" run typecheck
	@"$(GIT_BIN)" add -A
	@if "$(GIT_BIN)" diff --cached --quiet; then \
		echo "No changes to commit."; \
	else \
		"$(GIT_BIN)" commit -m "$(COMMIT_MSG)"; \
	fi
	@"$(GIT_BIN)" push
	@$(MAKE) purge-cdn
	@echo "Deploy completed."

print-cdn:
	@echo "CDN URLs:"
	@for file in $(CDN_FILES); do \
		echo "  $(CDN_BASE)/$$file"; \
	done
	@echo "Purge URLs:"
	@for file in $(CDN_FILES); do \
		echo "  $(PURGE_BASE)/$$file"; \
	done

purge-cdn: ensure-curl
	@echo "Purging jsDelivr cache for current alias URLs..."
	@for file in $(CDN_FILES); do \
		url="$(PURGE_BASE)/$$file"; \
		echo ""; \
		echo "==> $$url"; \
		"$(CURL_BIN)" --fail --silent --show-error "$$url"; \
		echo ""; \
	done
	@echo ""
	@echo "Purge requests finished. If the remote commit was pushed very recently, wait a moment and retry if needed."
